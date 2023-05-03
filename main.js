const { app, BrowserWindow, ipcMain } = require("electron");
const ConfigManager = require("./launcher/managers/ConfigManager");
const VersionManager = require("./launcher/managers/VersionManager");
const AccountsManager = require("./launcher/managers/AccountManager");
const LauncherMain = require("./launcher/Launcher");
const path = require("path");

const launchOptions = {
  accountObjSelected: "",
  versionNameSelected: "",
  memorySelected: { min: "512M", max: "1G" },
};

//TODO * dev only
require("electron-reload")(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`),
});

require("ejs-electron");

var mainWindow;

const createWindow = () => {
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    height: Math.round(height * 0.8),
    width: Math.round(width * 0.7),
    frame: false,
    webPreferences: {
      enableRemoteModule: false,
      contextIsolation: true,
      devTools: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets", "img", "icon.png"),
    title: "BetterLauncher",
  });
  mainWindow.setTitle("BetterLauncher");
  mainWindow.loadFile(path.join(__dirname, "views", "main.ejs"));

  // mainWindow.openDevTools();
  ConfigManager.loadConfig();
  AccountsManager.loadAccounts();
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("closeWindow", async (event) => {
  mainWindow.close();
});

ipcMain.on("minimalizeWindow", async (event) => {
  mainWindow.minimize();
});

ipcMain.on("openLoginMS", (event) => {
  LauncherMain.openLoginMS()
    .then(async (loginObj) => {
      const profile = await loginObj.getMinecraft();

      await AccountsManager.addAccount({
        premium: true,
        uuid: profile.profile.id,
        displayName: profile.profile.name,
        refreshToken: await loginObj.save(),
      });
    })
    .catch((err) => {
      console.log("err", err); // ? on gui closed or something xD
    });
});

ipcMain.on("useCracked", async (event, args) => {
  await AccountsManager.addAccount({
    premium: false,
    uuid: args.uuid,
    displayName: args.uuid,
  });
});

ipcMain.on("getAccounts", async (event) => {
  event.returnValue = await AccountsManager.getAccountsList();
});

ipcMain.on("selectedAccount", async (event, arg) => {
  launchOptions.accountObjSelected = await AccountsManager.getAccountByUUID(
    arg
  );
  console.log("zalogowano na konto", launchOptions.accountObjSelected);
  await AccountsManager.setLastAccount(arg);
});

ipcMain.on("getLastVersions", async (event) => {
  event.returnValue = await VersionManager.getLastVersions();
});

ipcMain.on("selectedVersion", async (event, arg) => {
  await VersionManager.addLastVersion(arg);
  launchOptions.versionNameSelected = arg;
  console.log("wybrano wersje:", launchOptions.versionNameSelected);
});

ipcMain.on("getInstalledVersions", async (event, arg) => {
  event.returnValue = await VersionManager.getInstalledVersions();
});

ipcMain.on("getVersionsByType", async (event, arg) => {
  const groupedVersions = Object.values(
    await VersionManager.getAvailableVersions(arg)
  )
    .map((ver) => ver.name)
    .reduce((acc, version) => {
      const majorMinor = version.split(".").slice(0, 2).join(".");
      if (!acc[majorMinor]) {
        acc[majorMinor] = [];
      }
      acc[majorMinor].push(version);
      return acc;
    }, {});

  event.returnValue = Object.values(groupedVersions);
});

ipcMain.on("getSummary", async (event) => {
  let safeOptions = JSON.stringify(launchOptions);
  safeOptions = JSON.parse(safeOptions);
  delete safeOptions.accountObjSelected.refreshToken;
  event.returnValue = safeOptions;
});

ipcMain.on("runClient", async (event) => {
  await LauncherMain.launchClient(
    launchOptions.accountObjSelected.refreshToken,
    (await ConfigManager.getVariable("rootPath")).replace(/\/\//g, "/"),
    launchOptions.versionNameSelected,
    launchOptions.memorySelected
  ).catch(console.log);
});
