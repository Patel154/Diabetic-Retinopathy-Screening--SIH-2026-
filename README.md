# RetinaBridge

RetinaBridge is a local research prototype for diabetic-retinopathy screening. It
combines a browser dashboard, a Python HTTP bridge, and optional MATLAB inference
for retinal fundus images.

> **Research prototype only.** This project is not a medical device, has not been
> clinically validated, and must not be used to diagnose patients or prescribe
> treatment. A qualified clinician must review every result.

## Features

- Patient intake with consent confirmation
- Local SQLite patient record storage
- PNG/JPEG fundus-image upload and quality checks
- Optional MATLAB model inference for DR Grades 0–4
- Reviewer notes, visual evidence, and print-to-PDF reporting
- Android WebView client for connecting to the local Windows server

## Architecture

```text
Browser or Android APK
          |
          v
     server.py  ---->  MATLAB batch inference (optional)
          |
          +---------> local retina_bridge.db
```

The current Android project is a client and does **not** contain the MATLAB
runtime or model. The phone must connect to a running server unless an
on-device model is added in a future change.

## Requirements

- Windows 10/11
- Python 3.11 or newer
- MATLAB with the toolboxes and model support package required by the MATLAB
  scripts
- A trained model file supplied separately by the project owner
- Android Studio only if building the optional Android client

Install Python dependencies:

```powershell
python -m pip install -r requirements.txt
```

## Run locally

```powershell
python server.py
```

Open <http://127.0.0.1:5000> in a browser. To configure MATLAB explicitly:

```powershell
$env:MATLAB_EXE = "C:\Program Files\MATLAB\R2025b\bin\matlab.exe"
python server.py
```

`START_WINDOWS.bat` is provided as a convenience for a local Windows setup.
Review it before use because MATLAB installation paths differ by machine.

If MATLAB or the trained model is unavailable, the server returns quality-only
results and does not invent a severity grade or confidence score.

## Android client

Open the `android` folder in Android Studio and build the debug APK. The APK
loads the same dashboard and connects to the server URL entered on its start
screen. See [android/README.md](android/README.md).

## Model and data policy

The trained model, patient database, datasets, generated predictions, APKs,
build outputs, and local IDE files are intentionally excluded from the public
repository. Do not commit patient information, retinal images, credentials,
private keys, MATLAB license files, or proprietary datasets.

Place a privately obtained model at `models/dr_model.mat` for local testing.
The public repository contains only source code and documentation.

## Testing

```powershell
python -m unittest discover -s tests -v
node --check web/app.js
```

## Clinical and privacy warning

Use de-identified demonstration data only. The local database contains
patient-provided information and must not be uploaded to a public repository.
The model output is experimental and must be independently reviewed by a
qualified eye-care professional. The application does not prescribe medication.
