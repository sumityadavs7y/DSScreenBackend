<?php
/**
 * GitHub Webhook Handler for cPanel Auto-Deployment
 * 
 * This file receives webhook notifications from GitHub when code is pushed
 * to the master branch, then triggers the deployment script.
 * 
 * Setup Instructions:
 * 1. Upload this file to your cPanel public directory (e.g., public_html/webhook.php)
 * 2. Set a secret key below (match it with GitHub webhook secret)
 * 3. Update the paths to match your cPanel directory structure
 * 4. Make sure deploy.sh is executable: chmod +x deploy.sh
 * 5. Add webhook URL to GitHub: https://yourdomain.com/webhook.php
 */

// Configuration
$SECRET_KEY = 'YOUR_SECRET_KEY_HERE'; // Change this and match with GitHub
$DEPLOY_SCRIPT = '/home/YOUR_CPANEL_USERNAME/deploy.sh';
$LOG_FILE = '/home/YOUR_CPANEL_USERNAME/deployment.log';
$ALLOWED_BRANCH = 'refs/heads/test_host'; // Testing branch

// Headers for JSON response
header('Content-Type: application/json');

// Function to log messages
function logMessage($message) {
    global $LOG_FILE;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($LOG_FILE, "[$timestamp] $message\n", FILE_APPEND);
}

// Function to send response and exit
function respond($status, $message) {
    http_response_code($status);
    echo json_encode(['status' => $status, 'message' => $message]);
    logMessage("Response: [$status] $message");
    exit;
}

try {
    logMessage("Webhook received from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    
    // Verify it's a POST request
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, 'Method not allowed. Only POST requests are accepted.');
    }
    
    // Get request headers
    $headers = getallheaders();
    
    // Verify GitHub signature
    $signature = $headers['X-Hub-Signature-256'] ?? $headers['x-hub-signature-256'] ?? '';
    
    if (empty($signature)) {
        respond(403, 'Missing signature header');
    }
    
    // Get payload
    $payload = file_get_contents('php://input');
    
    if (empty($payload)) {
        respond(400, 'Empty payload received');
    }
    
    // Calculate expected signature
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $SECRET_KEY);
    
    // Verify signature
    if (!hash_equals($expectedSignature, $signature)) {
        logMessage("Invalid signature. Expected: $expectedSignature, Got: $signature");
        respond(403, 'Invalid signature');
    }
    
    logMessage("Signature verified successfully");
    
    // Decode payload
    $data = json_decode($payload, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(400, 'Invalid JSON payload');
    }
    
    // Check if it's a push to the correct branch
    $ref = $data['ref'] ?? '';
    
    if ($ref !== $ALLOWED_BRANCH) {
        logMessage("Ignoring push to branch: $ref");
        respond(200, "Ignored: Push to $ref (only $ALLOWED_BRANCH triggers deployment)");
    }
    
    logMessage("Push to $ref detected. Starting deployment...");
    
    // Check if deploy script exists
    if (!file_exists($DEPLOY_SCRIPT)) {
        respond(500, "Deploy script not found at: $DEPLOY_SCRIPT");
    }
    
    // Check if deploy script is executable
    if (!is_executable($DEPLOY_SCRIPT)) {
        logMessage("Deploy script is not executable. Attempting to fix...");
        chmod($DEPLOY_SCRIPT, 0755);
    }
    
    // Execute deployment script
    logMessage("Executing deployment script: $DEPLOY_SCRIPT");
    
    $output = [];
    $returnCode = 0;
    
    exec("$DEPLOY_SCRIPT 2>&1", $output, $returnCode);
    
    $outputStr = implode("\n", $output);
    logMessage("Deployment output:\n$outputStr");
    
    if ($returnCode === 0) {
        logMessage("Deployment completed successfully");
        respond(200, "Deployment successful!\n\nOutput:\n$outputStr");
    } else {
        logMessage("Deployment failed with code: $returnCode");
        respond(500, "Deployment failed with code $returnCode\n\nOutput:\n$outputStr");
    }
    
} catch (Exception $e) {
    $errorMsg = "Exception: " . $e->getMessage();
    logMessage($errorMsg);
    respond(500, $errorMsg);
}
?>

