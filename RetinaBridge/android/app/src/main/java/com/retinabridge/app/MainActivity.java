package com.retinabridge.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.Uri;
import android.content.Intent;
import android.webkit.ValueCallback;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private WebView webView;
    private EditText serverUrl;
    private ValueCallback<Uri[]> uploadCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        showConnectionScreen();
    }

    private void showConnectionScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(36, 48, 36, 36);

        TextView title = new TextView(this);
        title.setText("RetinaBridge");
        title.setTextSize(28);
        title.setTextColor(0xff102d3e);
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        TextView help = new TextView(this);
        help.setText("For USB testing, keep the phone connected and run adb reverse. Use 127.0.0.1 below.");
        help.setTextSize(16);
        root.addView(help, new LinearLayout.LayoutParams(-1, -2));

        serverUrl = new EditText(this);
        serverUrl.setHint("http://127.0.0.1:5000/");
        serverUrl.setSingleLine(true);
        serverUrl.setText("http://127.0.0.1:5000/");
        root.addView(serverUrl, new LinearLayout.LayoutParams(-1, -2));

        Button connect = new Button(this);
        connect.setText("Connect to screening workspace");
        connect.setOnClickListener(view -> openDashboard(serverUrl.getText().toString().trim()));
        root.addView(connect, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
    }

    private void openDashboard(String address) {
        if (!address.endsWith("/")) address += "/";
        final String targetAddress = address;
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showConnectionError(     targetAddress);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, 42);
                    return true;
                } catch (Exception error) {
                    uploadCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
        setContentView(webView, new ViewGroup.LayoutParams(-1, -1));
        webView.loadUrl(targetAddress);
    }

    private void showConnectionError(String address) {
        showConnectionScreen();
        serverUrl.setText(address);
        serverUrl.setError("Cannot connect. Check same Wi-Fi and Windows Firewall.");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 42 && uploadCallback != null) {
            uploadCallback.onReceiveValue(
                    resultCode == RESULT_OK && data != null
                            ? new Uri[]{data.getData()} : null);
            uploadCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
