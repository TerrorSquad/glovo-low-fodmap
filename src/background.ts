import { BackgroundMessageHandler } from './background/BackgroundMessageHandler'
import { SyncOrchestrator } from './background/SyncOrchestrator'

// Initialize the background services
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT
const syncOrchestrator = new SyncOrchestrator(API_ENDPOINT)
const messageHandler = new BackgroundMessageHandler(syncOrchestrator)

// Setup message listener
messageHandler.setupListener()
