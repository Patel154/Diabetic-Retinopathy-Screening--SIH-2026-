# RetinaBridge Android app

This APK is a mobile client for the existing Windows MATLAB screening server. The
MATLAB model remains on Windows; the Android device and Windows computer must be
on the same Wi-Fi network.

## Build

1. Open `D:\SIH\RetinaBridge\android` in Android Studio.
2. Allow Gradle to download the Android Gradle Plugin and SDK 35.
3. Select **Build > Build APK(s)**.
4. Install `app\build\outputs\apk\debug\app-debug.apk` on the Android device.

## Run

1. Start `D:\SIH\RetinaBridge\START_WINDOWS.bat`.
2. Find the Windows Wi-Fi IPv4 address by running `ipconfig`.
3. In the APK, enter `http://WINDOWS_IP:5000/`, for example
   `http://192.168.1.10:5000/`.
4. Allow Python through Windows Firewall on private networks if Android cannot
   connect.

The APK loads the same patient intake, local database, image upload, MATLAB
screening, evidence, and report workflow as the browser dashboard.
