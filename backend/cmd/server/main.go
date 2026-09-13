package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/config"
	"github.com/video-teaching-research/backend/internal/handler"
	"github.com/video-teaching-research/backend/internal/middleware"
	"github.com/video-teaching-research/backend/internal/repository"
	"github.com/video-teaching-research/backend/internal/service"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Attempt database connection (non-fatal if DB_URL is empty)
	var db *repository.DB
	if cfg.DBURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		db, err = repository.NewDB(ctx, cfg.DBURL)
		if err != nil {
			log.Printf("WARNING: Failed to connect to database: %v", err)
			log.Printf("Server will start without database connectivity")
		} else {
			log.Printf("Connected to database successfully")
			defer db.Close()
		}
	} else {
		log.Printf("WARNING: DB_URL not set — running without database")
	}

	// --- Initialize services & handlers ---
	var authService *service.AuthService
	var authHandler *handler.AuthHandler
	var checklistHandler *handler.ChecklistHandler
	var videoHandler *handler.VideoHandler
	var pipelineHandler *handler.PipelineHandler
	var reportHandler *handler.ReportHandler
	var analysisHandler *handler.AnalysisHandler
	var codebookHandler *handler.CodebookHandler
	var settingsHandler *handler.SettingsHandler
	var activityLogHandler *handler.ActivityLogHandler

	// Initialize Blob Storage (Azure if credentials set, else Local fallback)
	var blobStorage service.BlobStorage
	if cfg.AzureStorageAccount != "" && cfg.AzureStorageKey != "" {
		azureStorage, err := service.NewAzureBlobStorage(cfg.AzureStorageAccount, cfg.AzureStorageKey, cfg.AzureContainerName)
		if err != nil {
			log.Printf("WARNING: Failed to init Azure Blob Storage: %v (falling back to local)", err)
			blobStorage, _ = service.NewLocalBlobStorage("./storage", "")
		} else {
			log.Printf("Initialized Azure Blob Storage (container: %s)", cfg.AzureContainerName)
			blobStorage = azureStorage
		}
	} else {
		log.Printf("Azure credentials not configured — using local storage fallback (./storage)")
		blobStorage, _ = service.NewLocalBlobStorage("./storage", "")
	}

	// Initialize AI Providers
	geminiProvider := ai.NewGeminiDirectProvider(cfg.GeminiAPIKey, cfg.GeminiModel)
	openRouterProvider := ai.NewOpenRouterProvider(cfg.OpenRouterAPIKey)

	var textProvider ai.TextCompletionProvider = openRouterProvider
	textModel := cfg.OpenRouterModel
	if cfg.OpenRouterAPIKey == "" {
		log.Printf("[AI] OPENROUTER_API_KEY is not set; using Gemini Direct (%s) for checklist mapping and theme analysis", cfg.GeminiModel)
		textProvider = geminiProvider
		textModel = cfg.GeminiModel
	}

	if db != nil {
		userRepo := repository.NewUserRepository(db)
		authService = service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiryHours)
		authHandler = handler.NewAuthHandler(authService)

		settingsRepo := repository.NewSettingsRepository(db)
		if err := settingsRepo.EnsureTablesAndSeed(context.Background()); err != nil {
			log.Printf("Warning: Failed to ensure AI settings tables: %v", err)
		}
		aiRouterSvc := service.NewAIRouterService(settingsRepo, cfg.GeminiAPIKey, cfg.GeminiModel, cfg.OpenRouterAPIKey, cfg.OpenRouterModel)
		settingsHandler = handler.NewSettingsHandler(aiRouterSvc)

		checklistRepo := repository.NewChecklistRepository(db)
		checklistService := service.NewChecklistService(checklistRepo)
		checklistHandler = handler.NewChecklistHandler(checklistService)

		chunkRepo := repository.NewChunkRepository(db)
		videoRepo := repository.NewVideoRepository(db)
		_ = videoRepo.EnsureColumns(context.Background())
		_ = videoRepo.CleanStuckUploadingVideos(context.Background())
		videoService := service.NewVideoService(videoRepo, chunkRepo, blobStorage)
		videoHandler = handler.NewVideoHandler(videoService)

		rawEventRepo := repository.NewRawEventRepository(db)
		mappingRepo := repository.NewMappingRepository(db)
		reportRepo := repository.NewReportRepository(db)
		analysisRepo := repository.NewAnalysisRepository(db)

		chunkingSvc := service.NewChunkingService(chunkRepo, videoRepo, blobStorage, cfg.FFmpegPath, cfg.ChunkDurationSec, cfg.ChunkOverlapSec)
		extractionSvc := service.NewExtractionService(rawEventRepo, chunkRepo, videoRepo, blobStorage, geminiProvider, cfg.MaxConcurrentChunks)
		extractionSvc.SetAIRouter(aiRouterSvc)
		
		dedupSvc := service.NewDeduplicationService(rawEventRepo, chunkRepo, videoRepo, 5.0)
		mappingSvc := service.NewMappingService(mappingRepo, rawEventRepo, checklistRepo, chunkRepo, videoRepo, textProvider, textModel)
		mappingSvc.SetAIRouter(aiRouterSvc)

		reportSvc := service.NewReportService(reportRepo, mappingRepo, checklistRepo, videoRepo, chunkRepo)
		analysisSvc := service.NewAnalysisService(analysisRepo, reportRepo, rawEventRepo, checklistRepo, videoRepo, textProvider, textModel)
		analysisSvc.SetAIRouter(aiRouterSvc)

		codebookRepo := repository.NewCodebookRepository(db)
		codebookSvc := service.NewCodebookService(codebookRepo, rawEventRepo, videoRepo, geminiProvider, cfg.CodebookModel)
		codebookSvc.SetAIRouter(aiRouterSvc)
		codebookHandler = handler.NewCodebookHandler(codebookSvc, videoService)

		// Telegram Subscribers & Bot Polling Worker
		telegramSubscriberRepo := repository.NewTelegramSubscriberRepository(db)
		if err := telegramSubscriberRepo.EnsureTable(context.Background()); err != nil {
			log.Printf("[Telegram] Warning: Failed to ensure telegram_subscribers table: %v", err)
		}

		orchestrator := service.NewPipelineOrchestrator(chunkingSvc, extractionSvc, dedupSvc, mappingSvc, reportSvc, codebookSvc, videoRepo, chunkRepo, checklistRepo, rawEventRepo, mappingRepo, reportRepo)
		telegramNotifier := service.NewTelegramNotifier(cfg.TelegramWebhookURL, cfg.TelegramBotToken, cfg.TelegramChatID, cfg.AppBaseURL)
		telegramNotifier.SetSubscriberRepository(telegramSubscriberRepo)
		orchestrator.SetTelegramNotifier(telegramNotifier)
		if telegramNotifier.IsEnabled() {
			log.Printf("[Telegram] Notification enabled (webhook/bot active)")
		} else {
			log.Printf("[Telegram] Notification disabled (no webhook URL or bot credentials configured)")
		}

		// Start Telegram Bot Polling Worker for /subscribe, /unsubscribe, etc.
		if cfg.TelegramBotToken != "" {
			telegramBotSvc := service.NewTelegramBotService(cfg.TelegramBotToken, telegramSubscriberRepo, cfg.AppBaseURL)
			go telegramBotSvc.Start(context.Background())
		}

		// Activity Log Repository & Service
		activityLogRepo := repository.NewActivityLogRepository(db)
		if err := activityLogRepo.EnsureTable(context.Background()); err != nil {
			log.Printf("[ActivityLog] Warning: Failed to ensure activity_logs table: %v", err)
		}
		activityLogSvc := service.NewActivityLogService(activityLogRepo)
		activityLogHandler = handler.NewActivityLogHandler(activityLogSvc)

		orchestrator.SetActivityLogger(activityLogSvc)
		videoHandler.SetActivityLogService(activityLogSvc)
		settingsHandler.SetTelegramNotifier(telegramNotifier)

		pipelineHandler = handler.NewPipelineHandler(orchestrator, rawEventRepo)
		reportHandler = handler.NewReportHandler(reportSvc)
		analysisHandler = handler.NewAnalysisHandler(analysisSvc)
	}

	// Set Gin mode
	gin.SetMode(cfg.GinMode)

	// Create router
	router := gin.Default()

	// Enable CORS for direct frontend interaction and streaming uploads
	router.Use(middleware.CORS())

	// Serve static files from local storage if using local fallback
	router.Static("/storage", "./storage")

	// --- Documentation & Playground (Scalar UI) ---
	docsHandler := handler.NewDocsHandler()
	router.GET("/openapi.yaml", docsHandler.OpenAPISpec)
	router.GET("/docs", docsHandler.ScalarUI)
	router.GET("/scalar", docsHandler.ScalarUI)

	// --- Public routes (no auth required) ---
	router.GET("/healthz", handler.HealthCheck)

	// --- API routes ---
	api := router.Group("/api")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			if authHandler != nil {
				auth.POST("/register", authHandler.Register)
				auth.POST("/login", authHandler.Login)
			}
		}

		// Protected routes (require JWT)
		if authService != nil {
			protected := api.Group("/")
			protected.Use(middleware.JWTAuth(authService))
			{
				// Auth - authenticated user info
				protected.GET("/auth/me", authHandler.Me)

				// Checklist routes — Task 4
				if checklistHandler != nil {
					checklists := protected.Group("/checklists")
					{
						checklists.GET("", checklistHandler.List)
						checklists.POST("", checklistHandler.Create)
						checklists.GET("/:id", checklistHandler.GetByID)
						checklists.PUT("/:id/items", checklistHandler.UpdateItems)
						checklists.DELETE("/:id", checklistHandler.Delete)
					}
				}

				// Video & Pipeline routes — Task 5, 8, 9, 12
				if videoHandler != nil {
					videos := protected.Group("/videos")
					{
						videos.POST("/upload", videoHandler.Upload)
						videos.GET("", videoHandler.List)
						videos.POST("/bulk-delete", videoHandler.BulkDelete)
						videos.GET("/:id", videoHandler.GetByID)
						videos.PATCH("/:id", videoHandler.Update)
						videos.PUT("/:id", videoHandler.Update)
						videos.DELETE("/:id", videoHandler.Delete)

						if pipelineHandler != nil {
							videos.POST("/:id/process", pipelineHandler.ProcessVideo)
							videos.POST("/:id/cancel", pipelineHandler.CancelVideo)
							videos.POST("/:id/stop", pipelineHandler.CancelVideo)
							videos.GET("/:id/pipeline", pipelineHandler.GetStatus)
							videos.DELETE("/:id/pipeline", pipelineHandler.ResetPipeline)
							videos.GET("/:id/events", pipelineHandler.GetEvents)
							videos.DELETE("/:id/events", pipelineHandler.DeleteEvents)
						}
					}
				}

				// Report routes — Task 11
				if reportHandler != nil {
					reports := protected.Group("/reports")
					{
						reports.GET("/video/:video_id", reportHandler.GetByVideoID)
						reports.DELETE("/video/:video_id", reportHandler.Delete)
						reports.GET("/video/:video_id/export.md", reportHandler.ExportMarkdown)
					}
				}

				// Phase 6 Analysis routes — Tasks 13–17
				if analysisHandler != nil {
					analysis := protected.Group("/analysis")
					{
						analysis.POST("/run", analysisHandler.RunAnalysis)
						analysis.GET("/runs", analysisHandler.ListRuns)
						analysis.GET("/latest", analysisHandler.GetLatestRun)
						analysis.DELETE("/:run_id", analysisHandler.DeleteRun)
						analysis.GET("/:run_id/themes", analysisHandler.GetThemes)
						analysis.PUT("/themes/:id", analysisHandler.UpdateTheme)
						analysis.POST("/themes/merge", analysisHandler.MergeThemes)
						analysis.PUT("/themes/:id/confirm", analysisHandler.ConfirmTheme)
						analysis.GET("/:run_id/teachers/:teacher_id", analysisHandler.GetTeacherAnalysis)
						analysis.GET("/:run_id/teachers/:teacher_id/interview.md", analysisHandler.ExportInterviewMarkdown)
					}
				}

				// Code Book routes
				if codebookHandler != nil {
					codebook := protected.Group("/codebook")
					{
						codebook.GET("/video/:video_id", codebookHandler.GetByVideoID)
						codebook.PUT("/video/:video_id", codebookHandler.SaveByVideoID)
						codebook.DELETE("/video/:video_id", codebookHandler.DeleteByVideoID)
						codebook.POST("/video/:video_id/generate", codebookHandler.GenerateByVideoID)
						codebook.GET("/export.xlsx", codebookHandler.ExportExcel)
					}
				}


				// Activity & Audit Log routes
				if activityLogHandler != nil {
					activityLogs := protected.Group("/activity-logs")
					{
						activityLogs.GET("", activityLogHandler.List)
						activityLogs.POST("", activityLogHandler.Create)
					}
				}

				// AI Settings & Key Router routes
				if settingsHandler != nil {
					settings := protected.Group("/settings")
					{
						settings.GET("/ai-flows", settingsHandler.GetAIFlows)
						settings.PUT("/ai-flows", settingsHandler.UpdateAIFlows)
						settings.GET("/api-keys", settingsHandler.ListAPIKeys)
						settings.POST("/api-keys", settingsHandler.CreateAPIKey)
						settings.PUT("/api-keys/:id", settingsHandler.UpdateAPIKey)
						settings.DELETE("/api-keys/:id", settingsHandler.DeleteAPIKey)
						settings.POST("/test-ping", settingsHandler.TestPing)
						settings.GET("/models", settingsHandler.ListModels)
						settings.POST("/models", settingsHandler.CreateModel)
						settings.PUT("/models/*id", settingsHandler.UpdateModel)
						settings.DELETE("/models/*id", settingsHandler.DeleteModel)
						settings.GET("/telegram/status", settingsHandler.GetTelegramStatus)
						settings.POST("/telegram/test", settingsHandler.SendTelegramTest)
					}
				}
			}
		}
	}

	// Start server with graceful shutdown
	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	// Run server in goroutine
	go func() {
		log.Printf("Starting server on %s (mode: %s)", addr, cfg.GinMode)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
