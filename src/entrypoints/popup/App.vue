<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { DiagnosticUtils } from "@/utils/DiagnosticUtils";
import { ErrorHandler } from "@/utils/ErrorHandler";
import { FeatureFlags } from "@/utils/FeatureFlags";
import { Logger } from "@/utils/Logger";
import { PerformanceMonitor } from "@/utils/PerformanceMonitor";

// Settings
const hideNonLowFodmap = ref(false);
const hideNonFoodItems = ref(false);
const darkMode = ref(false);
const tooltipFontSize = ref(13);

// Statistics
const totalProducts = ref("-");
const lowFodmapCount = ref("-");

// Status
const statusText = ref("Ready");
const statusIcon = ref("healthy");

// Debug section visibility
const debugMode = ref(false);

async function loadSettings() {
  try {
    chrome.storage.sync.get(
      {
        hideNonLowFodmap: false,
        hideNonFoodItems: false,
        darkMode: false,
        tooltipFontSize: 13,
      },
      (data) => {
        hideNonLowFodmap.value = data.hideNonLowFodmap;
        hideNonFoodItems.value = data.hideNonFoodItems;
        darkMode.value = data.darkMode;
        tooltipFontSize.value = data.tooltipFontSize;
        handleDarkModeToggle();
      }
    );
  } catch (error) {
    ErrorHandler.logError("Popup", error, { context: "Popup loadSettings" });
  }
}

async function loadStatistics() {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "getProductStatistics" },
          (response) => {
            if (response && typeof response === "object") {
              totalProducts.value = response.total?.toString() || "0";
              lowFodmapCount.value = response.lowFodmap?.toString() || "0";
              Logger.info(
                "Popup",
                `Statistics loaded: ${response.total || 0} total, ${
                  response.lowFodmap || 0
                } low FODMAP`
              );
            } else {
              totalProducts.value = "No tab";
              lowFodmapCount.value = "No tab";
            }
          }
        );
      } else {
        totalProducts.value = "No tab";
        lowFodmapCount.value = "No tab";
      }
    });
  } catch (error) {
    totalProducts.value = "Error";
    lowFodmapCount.value = "Error";
    ErrorHandler.logError("Popup", error, { context: "Loading statistics" });
  }
}

function updateStatus(text: string, type: "healthy" | "warning" | "error") {
  statusText.value = text;
  statusIcon.value = type;
}

function sendMessageToActiveTab(message: any) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message);
      Logger.info("Popup", `Sent message to tab: ${message.action}`);
    } else {
      Logger.warn("Popup", "No active tab found to send message");
    }
  });
}

function handleHideNonLowFodmapToggle() {
  const hide = hideNonLowFodmap.value;
  chrome.storage.sync.set({ hideNonLowFodmap: hide });
  Logger.info(
    "Popup",
    `Hide non-low-FODMAP toggle changed: hideNonLowFodmap = ${hide}`
  );
  sendMessageToActiveTab({ action: "refreshStyles", hideNonLowFodmap: hide });
}

function handleHideNonFoodItemsToggle() {
  const hide = hideNonFoodItems.value;
  chrome.storage.sync.set({ hideNonFoodItems: hide });
  Logger.info(
    "Popup",
    `Hide non-food toggle changed: hideNonFoodItems = ${hide}`
  );
  sendMessageToActiveTab({ action: "refreshStyles", hideNonFoodItems: hide });
}

function handleDarkModeToggle() {
  const isDark = darkMode.value;
  chrome.storage.sync.set({ darkMode: isDark });
  Logger.info("Popup", `Dark mode changed: darkMode = ${isDark}`);
}

function handleTooltipFontSizeChange() {
  const fontSize = tooltipFontSize.value;
  chrome.storage.sync.set({ tooltipFontSize: fontSize });
  Logger.info("Popup", `Tooltip font size changed: ${fontSize}px`);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "updateTooltipFontSize",
        fontSize,
      });
    }
  });
}

async function syncProducts() {
  updateStatus("Syncing unsubmitted products...", "warning");
  Logger.info("Popup", "Sync products button clicked");
  chrome.runtime.sendMessage({ action: "syncWithApi" });
  setTimeout(async () => {
    await loadStatistics();
    updateStatus("Products sync completed", "healthy");
    setTimeout(() => {
      updateStatus("Ready", "healthy");
    }, 3000);
  }, 2000);
}

async function pollStatus() {
  updateStatus("Polling status...", "warning");
  Logger.info("Popup", "Poll status button clicked");
  chrome.runtime.sendMessage({ action: "pollStatus" });
  setTimeout(async () => {
    await loadStatistics();
    updateStatus("Status poll completed", "healthy");
    setTimeout(() => {
      updateStatus("Ready", "healthy");
    }, 3000);
  }, 2000);
}

async function healthCheck() {
  updateStatus("Checking health...", "warning");
  const healthSummary = await DiagnosticUtils.quickHealthCheck();
  updateStatus(healthSummary, "healthy");
  console.log("Health Check:", healthSummary);
}

async function diagnostics() {
  updateStatus("Generating report...", "warning");
  await DiagnosticUtils.logDiagnostics();
  updateStatus("Report generated (check console)", "healthy");
}

async function exportData() {
  updateStatus("Exporting data...", "warning");
  await DiagnosticUtils.downloadDiagnostics();
  updateStatus("Data exported", "healthy");
}

function clearData() {
  if (confirm("Are you sure you want to clear all diagnostic data?")) {
    DiagnosticUtils.clearAllData();
    updateStatus("Data cleared", "healthy");
  }
}

function handleKeyDown(event: KeyboardEvent) {
  // Ctrl/Cmd + R: Refresh statistics
  if ((event.ctrlKey || event.metaKey) && event.key === "r") {
    event.preventDefault();
    loadStatistics();
  }
  // Ctrl/Cmd + S: Sync
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    syncProducts();
  }
  // Ctrl/Cmd + P: Poll status
  if ((event.ctrlKey || event.metaKey) && event.key === "p") {
    event.preventDefault();
    pollStatus();
  }
  // Ctrl/Cmd + D: Toggle dark mode
  if ((event.ctrlKey || event.metaKey) && event.key === "d") {
    event.preventDefault();
    handleDarkModeToggle();
  }
  // Space: Toggle switch
  if (event.key === " " && event.target === document.body) {
    event.preventDefault();
    hideNonLowFodmap.value = !hideNonLowFodmap.value;
    handleHideNonLowFodmapToggle();
  }
  // H: Health check
  if (event.key === "h" && !event.ctrlKey && !event.metaKey) {
    healthCheck();
  }
  // T: Diagnostics
  if (event.key === "t" && !event.ctrlKey && !event.metaKey) {
    diagnostics();
  }
}

onMounted(async () => {
  await PerformanceMonitor.measureAsync("popupInit", async () => {
    await loadSettings();
    await loadStatistics();
    debugMode.value = FeatureFlags.isDebugModeEnabled() ?? false;
    Logger.info("Popup", "Popup initialized successfully");
    document.addEventListener("keydown", handleKeyDown);
  });
});
</script>

<template>
  <div :class="['popup-container', { dark: darkMode }]">
    <div class="popup-header">
      <div class="popup-logo">F</div>
      <div class="popup-title">FODMAP Helper</div>
    </div>

    <div class="popup-section">
      <h3 class="section-title">Settings</h3>
      <div class="toggle-container">
        <label class="custom-switch">
          <input
            type="checkbox"
            v-model="hideNonLowFodmap"
            @change="handleHideNonLowFodmapToggle"
          />
          <span class="slider"></span>
        </label>
        <span>Hide non-low FODMAP products</span>
      </div>
      <div class="toggle-container">
        <label class="custom-switch">
          <input
            type="checkbox"
            v-model="hideNonFoodItems"
            @change="handleHideNonFoodItemsToggle"
          />
          <span class="slider"></span>
        </label>
        <span>Hide non-food items</span>
      </div>
      <div class="toggle-container">
        <label class="custom-switch">
          <input
            type="checkbox"
            @change="handleDarkModeToggle"
            v-model="darkMode"
          />
          <span class="slider"></span>
        </label>
        <span>Dark mode</span>
      </div>
      <div class="slider-container">
        <label for="tooltipFontSize">Tooltip font size</label>
        <div class="range-input-container">
          <input
            type="range"
            id="tooltipFontSize"
            min="12"
            max="18"
            step="1"
            v-model="tooltipFontSize"
            @change="handleTooltipFontSizeChange"
          />
          <span>{{ tooltipFontSize }}px</span>
        </div>
      </div>
    </div>

    <div class="popup-section">
      <h3 class="section-title">Actions</h3>
      <button class="btn" @click="syncProducts">Sync Products</button>
      <button class="btn btn-secondary" @click="pollStatus">Poll Status</button>
      <div class="status-container">
        <div :class="['status-icon', statusIcon]" />
        <span>{{ statusText }}</span>
      </div>
    </div>

    <div class="popup-section">
      <h3 class="section-title">Statistics</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ totalProducts }}</div>
          <div class="stat-label">Total Products</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ lowFodmapCount }}</div>
          <div class="stat-label">Low FODMAP</div>
        </div>
      </div>
    </div>

    <div class="popup-section debug-section" v-if="debugMode">
      <h3 class="section-title">Debug Tools</h3>
      <button class="btn btn-small btn-secondary" @click="healthCheck">
        Health Check
      </button>
      <button class="btn btn-small btn-secondary" @click="diagnostics">
        Full Report
      </button>
      <button class="btn btn-small btn-secondary" @click="exportData">
        Export Data
      </button>
      <button class="btn btn-small btn-secondary" @click="clearData">
        Clear Data
      </button>
      <div class="mt-2 text-xs text-gray-600 leading-tight">
        <strong>Shortcuts:</strong> Space=Toggle, ⌘S=Sync, ⌘P=Poll, ⌘D=Dark
        Mode, ⌘R=Refresh, H=Health, T=Debug
      </div>
    </div>
  </div>
</template>
