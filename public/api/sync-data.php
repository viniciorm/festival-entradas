<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$dataFile = __DIR__ . '/data_store.json';

// Initialize data_store.json if it doesn't exist
if (!file_exists($dataFile)) {
    $initialData = [
        'seats' => [],
        'participants' => [],
        'assignments' => [],
        'scanLogs' => [],
        'lastUpdated' => date('c')
    ];
    file_put_contents($dataFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

// GET: Retrieve central shared state
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $content = file_get_contents($dataFile);
    if ($content === false) {
        echo json_encode(['error' => 'Unable to read data store']);
        exit(1);
    }
    echo $content;
    exit(0);
}

// POST: Update central shared state
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $incoming = json_decode($input, true);

    if (!$incoming) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit(1);
    }

    $existing = json_decode(file_get_contents($dataFile), true) ?: [
        'seats' => [],
        'participants' => [],
        'assignments' => [],
        'scanLogs' => []
    ];

    // Merge incoming data updates
    if (isset($incoming['seats']) && is_array($incoming['seats'])) {
        $existing['seats'] = $incoming['seats'];
    }
    if (isset($incoming['participants']) && is_array($incoming['participants'])) {
        $existing['participants'] = $incoming['participants'];
    }
    if (isset($incoming['assignments']) && is_array($incoming['assignments'])) {
        $existing['assignments'] = $incoming['assignments'];
    }
    if (isset($incoming['scanLogs']) && is_array($incoming['scanLogs'])) {
        $existing['scanLogs'] = $incoming['scanLogs'];
    }
    if (isset($incoming['newScanLog']) && is_array($incoming['newScanLog'])) {
        if (!isset($existing['scanLogs']) || !is_array($existing['scanLogs'])) {
            $existing['scanLogs'] = [];
        }
        array_unshift($existing['scanLogs'], $incoming['newScanLog']);
    }

    $existing['lastUpdated'] = date('c');

    $saved = file_put_contents($dataFile, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    if ($saved === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save data']);
        exit(1);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Data synchronized successfully',
        'data' => $existing
    ]);
    exit(0);
}
