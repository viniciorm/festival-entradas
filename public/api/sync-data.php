<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Load MySQL / DB configuration
if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getDBConnection() {
    // If MySQL credentials defined in db_config.php
    if (defined('DB_TYPE') && DB_TYPE === 'mysql' && defined('DB_NAME') && DB_NAME !== 'festiva1_entradas') {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Create MySQL Tables if not exist
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS seats (
                id VARCHAR(10) PRIMARY KEY,
                row_name VARCHAR(5),
                seat_number INT,
                padded_number VARCHAR(10),
                block VARCHAR(10),
                status VARCHAR(20),
                assigned_participant_id VARCHAR(50),
                assigned_participant_name VARCHAR(255),
                ticket_code VARCHAR(100),
                pdf_filename VARCHAR(255),
                checked_in_at VARCHAR(50)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS participants (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                type VARCHAR(50),
                dancers_count INT,
                contact_person VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                school VARCHAR(255),
                teacher VARCHAR(255),
                instagram TEXT,
                facebook TEXT,
                tiktok TEXT,
                assigned_seats_count INT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS assignments (
                id VARCHAR(50) PRIMARY KEY,
                date_str VARCHAR(50),
                participant_id VARCHAR(50),
                participant_name VARCHAR(255),
                seat_ids_json TEXT,
                sent_to_email VARCHAR(255),
                sent_by VARCHAR(255),
                status VARCHAR(50)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS scan_logs (
                id VARCHAR(50) PRIMARY KEY,
                time_str VARCHAR(50),
                seat_id VARCHAR(10),
                row_name VARCHAR(5),
                seat_number INT,
                participant_name VARCHAR(255),
                status VARCHAR(50),
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        foreach (['school' => 'VARCHAR(255)', 'teacher' => 'VARCHAR(255)', 'instagram' => 'TEXT', 'facebook' => 'TEXT', 'tiktok' => 'TEXT'] as $col => $type) {
            try {
                $pdo->exec("ALTER TABLE participants ADD COLUMN $col $type");
            } catch (Exception $e) {
                // Column already exists
            }
        }

        return $pdo;
    }

    // Fallback to SQLite if MySQL is not configured yet
    $dbFile = __DIR__ . '/festival_database.sqlite';
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS seats (
            id TEXT PRIMARY KEY,
            row_name TEXT,
            seat_number INTEGER,
            padded_number TEXT,
            block TEXT,
            status TEXT,
            assigned_participant_id TEXT,
            assigned_participant_name TEXT,
            ticket_code TEXT,
            pdf_filename TEXT,
            checked_in_at TEXT
        );

        CREATE TABLE IF NOT EXISTS participants (
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            dancers_count INTEGER,
            contact_person TEXT,
            email TEXT,
            phone TEXT,
            school TEXT,
            teacher TEXT,
            instagram TEXT,
            facebook TEXT,
            tiktok TEXT,
            assigned_seats_count INTEGER
        );

        CREATE TABLE IF NOT EXISTS assignments (
            id TEXT PRIMARY KEY,
            date_str TEXT,
            participant_id TEXT,
            participant_name TEXT,
            seat_ids_json TEXT,
            sent_to_email TEXT,
            sent_by TEXT,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS scan_logs (
            id TEXT PRIMARY KEY,
            time_str TEXT,
            seat_id TEXT,
            row_name TEXT,
            seat_number INTEGER,
            participant_name TEXT,
            status TEXT,
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    foreach (['school', 'teacher', 'instagram', 'facebook', 'tiktok'] as $col) {
        try {
            $pdo->exec("ALTER TABLE participants ADD COLUMN $col TEXT");
        } catch (Exception $e) {
            // Column already exists
        }
    }

    return $pdo;
}

// Generate standard 544 theater seats
function generateDefaultSeats() {
    $seats = [];
    $rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
    $globalIndex = 1;

    foreach ($rows as $rowName) {
        for ($col = 1; $col <= 34; $col++) {
            $block = 'center';
            if ($col <= 8) {
                $block = 'left';
            } else if ($col >= 27) {
                $block = 'right';
            }

            $paddedNumber = sprintf('%06d', $globalIndex);
            $id = $rowName . $col;

            $seats[] = [
                'id' => $id,
                'row' => $rowName,
                'number' => $col,
                'paddedNumber' => $paddedNumber,
                'block' => $block,
                'status' => 'available',
                'assignedParticipantId' => null,
                'assignedParticipantName' => null,
                'ticketCode' => null,
                'pdfFilename' => sprintf('%s%sFDVC2026-CL.pdf', $rowName, $paddedNumber),
                'checkedInAt' => null
            ];

            $globalIndex++;
        }
    }
    return $seats;
}

function getDefaultParticipants() {
    return [
        ['id' => 'part-1', 'name' => 'Ana Francisca Pizarro Ruiz', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Reflejos de Oriente Tarapacá', 'teacher' => 'Adriana Campos', 'contactPerson' => 'Adriana Campos', 'email' => 'anapizarroruiz@gmail.com', 'phone' => '+56982840695', 'instagram' => '@anafcaaa', 'facebook' => 'https://www.facebook.com/share/1CB7u9Q3jW/', 'tiktok' => '@ana.franciska', 'assignedSeatsCount' => 0],
        ['id' => 'part-2', 'name' => 'Grupo Shazaditas Teens', 'type' => 'grupo', 'dancersCount' => 8, 'school' => 'Estudio Shazadi Fitness Integrado', 'teacher' => 'Shazadi', 'contactPerson' => 'Shazadi', 'email' => 'profesorashazadi@gmail.com', 'phone' => '+56956208233', 'instagram' => '@shazadioficial, @shazadi.fitnessintegrado', 'facebook' => 'Shazadi', 'tiktok' => 'Shazadi Fitness Integrado', 'assignedSeatsCount' => 0],
        ['id' => 'part-3', 'name' => 'Grupo Shazaditas Evolution', 'type' => 'grupo', 'dancersCount' => 10, 'school' => 'Estudio Shazadi Fitness Integrado', 'teacher' => 'Shazadi', 'contactPerson' => 'Shazadi', 'email' => 'profesorashazadi@gmail.com', 'phone' => '+56956208233', 'instagram' => '@shazadioficial, @shazadi.fitnessintegrado', 'facebook' => 'Shazadi', 'tiktok' => 'Shazadi Fitness Integrado', 'assignedSeatsCount' => 0],
        ['id' => 'part-4', 'name' => 'Grupo Shazaditas Essence', 'type' => 'grupo', 'dancersCount' => 8, 'school' => 'Estudio Shazadi Fitness Integrado', 'teacher' => 'Shazadi', 'contactPerson' => 'Shazadi', 'email' => 'profesorashazadi@gmail.com', 'phone' => '+56956208233', 'instagram' => '@shazadioficial, @shazadi.fitnessintegrado', 'facebook' => 'Shazadi', 'tiktok' => 'Shazadi Fitness Integrado', 'assignedSeatsCount' => 0],
        ['id' => 'part-5', 'name' => 'Ballet Shazaditas Styles', 'type' => 'grupo', 'dancersCount' => 12, 'school' => 'Estudio Shazadi Fitness Integrado', 'teacher' => 'Shazadi', 'contactPerson' => 'Shazadi', 'email' => 'profesorashazadi@gmail.com', 'phone' => '+56956208233', 'instagram' => '@shazadioficial, @shazadi.fitnessintegrado', 'facebook' => 'Shazadi', 'tiktok' => 'Shazadi Fitness Integrado', 'assignedSeatsCount' => 0],
        ['id' => 'part-6', 'name' => 'Adriana Campos', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Reflejos de Oriente', 'teacher' => 'Adriana Campos', 'contactPerson' => 'Adriana Campos', 'email' => 'adrianacamposchile@gmail.com', 'phone' => '+56998312127', 'instagram' => '@adrianacamposchile, @reflejosdeoriente', 'facebook' => 'Adriana Campos Reflejos de Oriente', 'tiktok' => '@adrianacamposchile, @reflejosdeorientechile', 'assignedSeatsCount' => 0],
        ['id' => 'part-7', 'name' => 'Adarah Bellydance', 'type' => 'grupo', 'dancersCount' => 6, 'school' => 'Raks Al Hayat', 'teacher' => 'Cristina Fuentes', 'contactPerson' => 'Cristina Fuentes', 'email' => 'bellydance.adarah@gmail.com', 'phone' => '+56985492036', 'instagram' => '@adarah_bellydance, @krissfuentes', 'facebook' => 'Cristina Fuentes', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-8', 'name' => 'Daisy Bustos Sánchez / Kardelens', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Bailarina solista', 'teacher' => 'Daisy Bustos Sánchez', 'contactPerson' => 'Daisy Bustos Sánchez', 'email' => 'duqsa.daisy@gmail.com', 'phone' => '+56991453275', 'instagram' => '@__kardelens', 'facebook' => 'Daisy M Bustos S', 'tiktok' => '@__kardelens', 'assignedSeatsCount' => 0],
        ['id' => 'part-9', 'name' => 'Priscilla Bellydancer', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Raks El Hob', 'teacher' => 'Priscilla Bellydancer', 'contactPerson' => 'Priscilla Bellydancer', 'email' => 'priscillavelarde@hotmail.com', 'phone' => '+56961680169', 'instagram' => '@priscilla_bellydance', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-10', 'name' => 'Grupo de alumnas (Fabiola Andrade)', 'type' => 'grupo', 'dancersCount' => 15, 'school' => 'Escuela de Danza Oriental Fabiola Andrade', 'teacher' => 'Fabiola Andrade Benavides', 'contactPerson' => 'Fabiola Andrade Benavides', 'email' => 'fabiola.danzaa@gmail.com', 'phone' => '+56962134849', 'instagram' => '@fabioladanzaholistica, @siembrasdearte', 'facebook' => 'Fabiola Andrade Benavides', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-11', 'name' => 'Raks Mahaila', 'type' => 'grupo', 'dancersCount' => 10, 'school' => 'Mahaila May y alumnas', 'teacher' => 'María Soledad Lazo / Mahaila', 'contactPerson' => 'María Soledad Lazo / Mahaila', 'email' => 'mayartistico@gmail.com', 'phone' => '+56996995261', 'instagram' => '@danzaypilates_mahailamay', 'facebook' => 'Mahaila May Lazo', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-12', 'name' => 'Casandra (Solista)', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Casandra', 'teacher' => 'Mabel Casandra Parra Albarrán', 'contactPerson' => 'Mabel Casandra Parra Albarrán', 'email' => 'mabel.parra.albarran@gmail.com', 'phone' => '+56999957255', 'instagram' => '@casandra_albarran', 'facebook' => 'Casandra Albarrán', 'tiktok' => 'Casandra Bellydancer', 'assignedSeatsCount' => 0],
        ['id' => 'part-13', 'name' => 'Grupo Casandra', 'type' => 'grupo', 'dancersCount' => 8, 'school' => 'Casandra', 'teacher' => 'Mabel Casandra Parra Albarrán', 'contactPerson' => 'Mabel Casandra Parra Albarrán', 'email' => 'mabel.parra.albarran@gmail.com', 'phone' => '+56999957255', 'instagram' => '@casandra_albarran', 'facebook' => 'Casandra Albarrán', 'tiktok' => 'Casandra Bellydancer', 'assignedSeatsCount' => 0],
        ['id' => 'part-14', 'name' => 'Grupo Arwam al shams', 'type' => 'grupo', 'dancersCount' => 6, 'school' => 'Academia Farida Warda', 'teacher' => 'Farida Warda', 'contactPerson' => 'Farida Warda', 'email' => 'faridawarda.bailarina@gmail.com', 'phone' => '+56975875954', 'instagram' => '@arwamalshams', 'facebook' => 'Academia Farida Warda', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-15', 'name' => 'Grupo Festival Raks El Hob', 'type' => 'grupo', 'dancersCount' => 12, 'school' => 'Festival Raks El Hob', 'teacher' => 'Priscilla', 'contactPerson' => 'Priscilla', 'email' => 'priscillavelarde@hotmail.com', 'phone' => '+56961680169', 'instagram' => '@festival_raks_el_hob', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-16', 'name' => 'Arwah al Azhar', 'type' => 'grupo', 'dancersCount' => 8, 'school' => 'Sayes Bellydance', 'teacher' => 'Vania Sayes', 'contactPerson' => 'Vania Sayes', 'email' => 'sayesvania77@gmail.com', 'phone' => '+56956253440', 'instagram' => '@arwahalazhar.ballet', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-17', 'name' => 'Sofía Martínez', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Sofía Martínez', 'teacher' => 'Sofía Martínez', 'contactPerson' => 'Sofía Martínez', 'email' => 'ansolu23@hotmail.com', 'phone' => '+569945391326', 'instagram' => '@ansolu23', 'facebook' => 'Sofía Hernández Martínez', 'tiktok' => '@ansolu23', 'assignedSeatsCount' => 0],
        ['id' => 'part-18', 'name' => 'Grupo Habibi Danza', 'type' => 'grupo', 'dancersCount' => 10, 'school' => 'Habibi Danza Cajón del Maipo', 'teacher' => 'Cristina Acevedo', 'contactPerson' => 'Cristina Acevedo', 'email' => 'habibidanzacajondelmaipo@gmail.com', 'phone' => '+56984556278', 'instagram' => '@habibidanzacajondelmaipo', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-19', 'name' => 'Grupo Will Bellydancer', 'type' => 'grupo', 'dancersCount' => 12, 'school' => 'Escuela Will Bellydancer', 'teacher' => 'Wilma Galleguillos Fuentes', 'contactPerson' => 'Wilma Galleguillos Fuentes', 'email' => 'willcarolina2@gmail.com', 'phone' => '+56991428303', 'instagram' => '@willbellydancer, @escuela_willbellydancer', 'facebook' => 'Wilma Galleguillos Will Bellydancer San Bernardo', 'tiktok' => '@willbellydancer2.0', 'assignedSeatsCount' => 0],
        ['id' => 'part-20', 'name' => 'Grupo Malikas', 'type' => 'grupo', 'dancersCount' => 6, 'school' => 'Dana Amar', 'teacher' => 'Dana Amar / Javiera Avendaño', 'contactPerson' => 'Dana Amar / Javiera Avendaño', 'email' => 'javiera.avendano@gmail.com', 'phone' => '+56982194471', 'instagram' => '@jaivalaseca', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-21', 'name' => 'Grupo Zahra Al Ruh', 'type' => 'grupo', 'dancersCount' => 8, 'school' => 'Dana Amar', 'teacher' => 'Danahe Zablah / Claudia Álvarez', 'contactPerson' => 'Danahe Zablah / Claudia Álvarez', 'email' => 'claudialvarezc8@gmail.com', 'phone' => '+56956036534', 'instagram' => '@_bazar_clau', 'facebook' => 'Claudia Andrea Álvarez Concha', 'tiktok' => '@claudiaalvarez6354', 'assignedSeatsCount' => 0],
        ['id' => 'part-22', 'name' => 'Grupo Alsabalal', 'type' => 'grupo', 'dancersCount' => 8, 'school' => 'Academia Farida Warda', 'teacher' => 'Farida Warda', 'contactPerson' => 'Farida Warda', 'email' => 'faridawarda.bailarina@gmail.com', 'phone' => '+56975875954', 'instagram' => '@alsabalal', 'facebook' => 'Academia Farida Warda', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-23', 'name' => 'Nazarena', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Dana Amar', 'teacher' => 'Dana Amar / Antonia Paz Lama', 'contactPerson' => 'Dana Amar / Antonia Paz Lama', 'email' => 'antopazlama@gmail.com', 'phone' => '+56972535664', 'instagram' => '@antooo_lama', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-24', 'name' => 'Raquel Farías', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Mawal', 'teacher' => 'Raquel Farías', 'contactPerson' => 'Raquel Farías', 'email' => 'raquel_fariasgordon@yahoo.es', 'phone' => '+56997309988', 'instagram' => '@profe.danza.arabe', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-25', 'name' => 'Diana Valle', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Diana Valle González', 'teacher' => 'Diana Valle González', 'contactPerson' => 'Diana Valle González', 'email' => 'katherine.valle@gmail.com', 'phone' => '+56995126639', 'instagram' => '@dianavalle_danzadelvientre', 'facebook' => '@diana.vallegonzalez', 'tiktok' => '', 'assignedSeatsCount' => 0],
        ['id' => 'part-26', 'name' => 'Anne Marie Lolas', 'type' => 'solista', 'dancersCount' => 1, 'school' => 'Anne Marie Lolas', 'teacher' => 'Anne Marie Lolas', 'contactPerson' => 'Anne Marie Lolas', 'email' => 'anne.lolas.s@gmail.com', 'phone' => '+56992517727', 'instagram' => '@anne_lolas_danzarabe', 'facebook' => '', 'tiktok' => '', 'assignedSeatsCount' => 0],
    ];
}

// Process GET Request: PURE READ-ONLY (No database mutations on GET!)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = getDBConnection();

        // Seed seats table ONLY if table is completely empty
        $countStmt = $pdo->query("SELECT COUNT(*) FROM seats");
        if ((int)$countStmt->fetchColumn() < 544) {
            $pdo->beginTransaction();
            $isMySQL = defined('DB_TYPE') && DB_TYPE === 'mysql';
            $sql = $isMySQL
                ? "INSERT INTO seats (id, row_name, seat_number, padded_number, block, status, assigned_participant_id, assigned_participant_name, ticket_code, pdf_filename, checked_in_at)
                   VALUES (:id, :row_name, :seat_number, :padded_number, :block, :status, :assigned_participant_id, :assigned_participant_name, :ticket_code, :pdf_filename, :checked_in_at)
                   ON DUPLICATE KEY UPDATE status=status"
                : "INSERT OR IGNORE INTO seats (id, row_name, seat_number, padded_number, block, status, assigned_participant_id, assigned_participant_name, ticket_code, pdf_filename, checked_in_at)
                   VALUES (:id, :row_name, :seat_number, :padded_number, :block, :status, :assigned_participant_id, :assigned_participant_name, :ticket_code, :pdf_filename, :checked_in_at)";

            $insertSeat = $pdo->prepare($sql);
            foreach (generateDefaultSeats() as $s) {
                $insertSeat->execute([
                    ':id' => $s['id'],
                    ':row_name' => $s['row'],
                    ':seat_number' => $s['number'],
                    ':padded_number' => $s['paddedNumber'],
                    ':block' => $s['block'],
                    ':status' => $s['status'],
                    ':assigned_participant_id' => $s['assignedParticipantId'],
                    ':assigned_participant_name' => $s['assignedParticipantName'],
                    ':ticket_code' => $s['ticketCode'],
                    ':pdf_filename' => $s['pdfFilename'],
                    ':checked_in_at' => $s['checkedInAt']
                ]);
            }
            $pdo->commit();
        }

        // Seed participants ONLY if table is completely empty
        $countP = $pdo->query("SELECT COUNT(*) FROM participants");
        if ((int)$countP->fetchColumn() === 0) {
            $pdo->beginTransaction();
            $isMySQL = defined('DB_TYPE') && DB_TYPE === 'mysql';
            $sqlP = $isMySQL
                ? "INSERT INTO participants (id, name, type, dancers_count, contact_person, email, phone, school, teacher, instagram, facebook, tiktok, assigned_seats_count)
                   VALUES (:id, :name, :type, :dancers_count, :contact_person, :email, :phone, :school, :teacher, :instagram, :facebook, :tiktok, :assigned_seats_count)"
                : "INSERT INTO participants (id, name, type, dancers_count, contact_person, email, phone, school, teacher, instagram, facebook, tiktok, assigned_seats_count)
                   VALUES (:id, :name, :type, :dancers_count, :contact_person, :email, :phone, :school, :teacher, :instagram, :facebook, :tiktok, :assigned_seats_count)";

            $insertP = $pdo->prepare($sqlP);
            foreach (getDefaultParticipants() as $p) {
                $insertP->execute([
                    ':id' => $p['id'],
                    ':name' => $p['name'],
                    ':type' => $p['type'],
                    ':dancers_count' => $p['dancersCount'],
                    ':contact_person' => $p['contactPerson'],
                    ':email' => $p['email'],
                    ':phone' => $p['phone'],
                    ':school' => isset($p['school']) ? $p['school'] : '',
                    ':teacher' => isset($p['teacher']) ? $p['teacher'] : '',
                    ':instagram' => isset($p['instagram']) ? $p['instagram'] : '',
                    ':facebook' => isset($p['facebook']) ? $p['facebook'] : '',
                    ':tiktok' => isset($p['tiktok']) ? $p['tiktok'] : '',
                    ':assigned_seats_count' => $p['assignedSeatsCount']
                ]);
            }
            $pdo->commit();
        }

        // ONE-TIME CLEANUP FOR TEENS CONFLICT RECORD
        $pdo->exec("UPDATE assignments SET seat_ids_json = '[\"B9\",\"B10\",\"B11\",\"B12\",\"B13\",\"B14\",\"B15\"]' WHERE id = 'asgn-1786381664534'");

        // Fetch seats (PURE READ-ONLY)
        $seatRows = $pdo->query("SELECT * FROM seats ORDER BY row_name ASC, seat_number ASC")->fetchAll();
        $seats = array_map(function($r) {
            return [
                'id' => $r['id'],
                'row' => $r['row_name'],
                'number' => (int)$r['seat_number'],
                'paddedNumber' => $r['padded_number'],
                'block' => $r['block'],
                'status' => $r['status'],
                'assignedParticipantId' => $r['assigned_participant_id'],
                'assignedParticipantName' => $r['assigned_participant_name'],
                'ticketCode' => $r['ticket_code'],
                'pdfFilename' => $r['pdf_filename'],
                'checkedInAt' => $r['checked_in_at']
            ];
        }, $seatRows);

        // Fetch participants (PURE READ-ONLY)
        $partRows = $pdo->query("SELECT * FROM participants ORDER BY name ASC")->fetchAll();
        $participants = array_map(function($r) {
            return [
                'id' => $r['id'],
                'name' => $r['name'],
                'type' => $r['type'],
                'dancersCount' => (int)$r['dancers_count'],
                'contactPerson' => $r['contact_person'],
                'email' => $r['email'],
                'phone' => $r['phone'],
                'school' => isset($r['school']) ? $r['school'] : '',
                'teacher' => isset($r['teacher']) ? $r['teacher'] : '',
                'instagram' => isset($r['instagram']) ? $r['instagram'] : '',
                'facebook' => isset($r['facebook']) ? $r['facebook'] : '',
                'tiktok' => isset($r['tiktok']) ? $r['tiktok'] : '',
                'assignedSeatsCount' => (int)$r['assigned_seats_count']
            ];
        }, $partRows);

        // Fetch assignments (PURE READ-ONLY)
        $asgnRows = $pdo->query("SELECT * FROM assignments ORDER BY date_str DESC, id DESC")->fetchAll();
        $assignments = array_map(function($r) {
            return [
                'id' => $r['id'],
                'date' => $r['date_str'],
                'participantId' => $r['participant_id'],
                'participantName' => $r['participant_name'],
                'seatIds' => json_decode($r['seat_ids_json'], true) ?: [],
                'sentToEmail' => $r['sent_to_email'],
                'sentBy' => $r['sent_by'],
                'status' => $r['status']
            ];
        }, $asgnRows);

        // Fetch scan logs (PURE READ-ONLY)
        $logRows = $pdo->query("SELECT * FROM scan_logs ORDER BY id DESC LIMIT 100")->fetchAll();
        $scanLogs = array_map(function($r) {
            return [
                'id' => $r['id'],
                'time' => $r['time_str'],
                'seatId' => $r['seat_id'],
                'row' => $r['row_name'],
                'number' => (int)$r['seat_number'],
                'participantName' => $r['participant_name'],
                'status' => $r['status'],
                'message' => $r['message']
            ];
        }, $logRows);

        echo json_encode([
            'engine' => (defined('DB_TYPE') && DB_TYPE === 'mysql') ? 'mysql_phpmyadmin' : 'sqlite_database',
            'seats' => $seats,
            'participants' => $participants,
            'assignments' => $assignments,
            'scanLogs' => $scanLogs,
            'lastUpdated' => date('c')
        ], JSON_UNESCAPED_UNICODE);
        exit(0);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        exit(1);
    }
}

// Process POST Request: Update Database
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $incoming = json_decode($input, true);

    if (!$incoming) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit(1);
    }

    try {
        $pdo = getDBConnection();
        $pdo->beginTransaction();

        // Update seats
        if (isset($incoming['seats']) && is_array($incoming['seats'])) {
            $stmtSeat = $pdo->prepare("
                UPDATE seats SET
                    status = :status,
                    assigned_participant_id = :assigned_participant_id,
                    assigned_participant_name = :assigned_participant_name,
                    ticket_code = :ticket_code,
                    pdf_filename = :pdf_filename,
                    checked_in_at = :checked_in_at
                WHERE id = :id
            ");

            foreach ($incoming['seats'] as $s) {
                $stmtSeat->execute([
                    ':id' => $s['id'],
                    ':status' => $s['status'],
                    ':assigned_participant_id' => isset($s['assignedParticipantId']) ? $s['assignedParticipantId'] : null,
                    ':assigned_participant_name' => isset($s['assignedParticipantName']) ? $s['assignedParticipantName'] : null,
                    ':ticket_code' => isset($s['ticketCode']) ? $s['ticketCode'] : null,
                    ':pdf_filename' => isset($s['pdfFilename']) ? $s['pdfFilename'] : null,
                    ':checked_in_at' => isset($s['checkedInAt']) ? $s['checkedInAt'] : null
                ]);
            }
        }

        // Update participants
        if (isset($incoming['participants']) && is_array($incoming['participants'])) {
            $isMySQL = defined('DB_TYPE') && DB_TYPE === 'mysql';
            $sqlP = $isMySQL
                ? "INSERT INTO participants (id, name, type, dancers_count, contact_person, email, phone, school, teacher, instagram, facebook, tiktok, assigned_seats_count)
                   VALUES (:id, :name, :type, :dancers_count, :contact_person, :email, :phone, :school, :teacher, :instagram, :facebook, :tiktok, :assigned_seats_count)
                   ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), phone=VALUES(phone), school=VALUES(school), teacher=VALUES(teacher), instagram=VALUES(instagram), facebook=VALUES(facebook), tiktok=VALUES(tiktok), assigned_seats_count=VALUES(assigned_seats_count)"
                : "INSERT INTO participants (id, name, type, dancers_count, contact_person, email, phone, school, teacher, instagram, facebook, tiktok, assigned_seats_count)
                   VALUES (:id, :name, :type, :dancers_count, :contact_person, :email, :phone, :school, :teacher, :instagram, :facebook, :tiktok, :assigned_seats_count)
                   ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, phone=excluded.phone, school=excluded.school, teacher=excluded.teacher, instagram=excluded.instagram, facebook=excluded.facebook, tiktok=excluded.tiktok, assigned_seats_count=excluded.assigned_seats_count";

            $stmtP = $pdo->prepare($sqlP);
            foreach ($incoming['participants'] as $p) {
                $stmtP->execute([
                    ':id' => $p['id'],
                    ':name' => $p['name'],
                    ':type' => isset($p['type']) ? $p['type'] : 'grupo',
                    ':dancers_count' => isset($p['dancersCount']) ? (int)$p['dancersCount'] : 1,
                    ':contact_person' => isset($p['contactPerson']) ? $p['contactPerson'] : '',
                    ':email' => isset($p['email']) ? $p['email'] : '',
                    ':phone' => isset($p['phone']) ? $p['phone'] : '',
                    ':school' => isset($p['school']) ? $p['school'] : '',
                    ':teacher' => isset($p['teacher']) ? $p['teacher'] : '',
                    ':instagram' => isset($p['instagram']) ? $p['instagram'] : '',
                    ':facebook' => isset($p['facebook']) ? $p['facebook'] : '',
                    ':tiktok' => isset($p['tiktok']) ? $p['tiktok'] : '',
                    ':assigned_seats_count' => isset($p['assignedSeatsCount']) ? (int)$p['assignedSeatsCount'] : 0
                ]);
            }
        }

        // Update assignments
        if (isset($incoming['assignments']) && is_array($incoming['assignments'])) {
            $isMySQL = defined('DB_TYPE') && DB_TYPE === 'mysql';
            $sqlA = $isMySQL
                ? "INSERT INTO assignments (id, date_str, participant_id, participant_name, seat_ids_json, sent_to_email, sent_by, status)
                   VALUES (:id, :date_str, :participant_id, :participant_name, :seat_ids_json, :sent_to_email, :sent_by, :status)
                   ON DUPLICATE KEY UPDATE seat_ids_json=VALUES(seat_ids_json), sent_to_email=VALUES(sent_to_email), status=VALUES(status)"
                : "INSERT INTO assignments (id, date_str, participant_id, participant_name, seat_ids_json, sent_to_email, sent_by, status)
                   VALUES (:id, :date_str, :participant_id, :participant_name, :seat_ids_json, :sent_to_email, :sent_by, :status)
                   ON CONFLICT(id) DO UPDATE SET seat_ids_json=excluded.seat_ids_json, sent_to_email=excluded.sent_to_email, status=excluded.status";

            $stmtA = $pdo->prepare($sqlA);
            foreach ($incoming['assignments'] as $a) {
                $stmtA->execute([
                    ':id' => $a['id'],
                    ':date_str' => isset($a['date']) ? $a['date'] : date('d/m/Y H:i'),
                    ':participant_id' => $a['participantId'],
                    ':participant_name' => $a['participantName'],
                    ':seat_ids_json' => json_encode(isset($a['seatIds']) ? $a['seatIds'] : []),
                    ':sent_to_email' => isset($a['sentToEmail']) ? $a['sentToEmail'] : '',
                    ':sent_by' => isset($a['sentBy']) ? $a['sentBy'] : 'Sistema',
                    ':status' => isset($a['status']) ? $a['status'] : 'Asignado'
                ]);
            }
        }

        // Insert new scan log
        if (isset($incoming['newScanLog']) && is_array($incoming['newScanLog'])) {
            $l = $incoming['newScanLog'];
            $isMySQL = defined('DB_TYPE') && DB_TYPE === 'mysql';
            $sqlL = $isMySQL
                ? "INSERT INTO scan_logs (id, time_str, seat_id, row_name, seat_number, participant_name, status, message)
                   VALUES (:id, :time_str, :seat_id, :row_name, :seat_number, :participant_name, :status, :message)
                   ON DUPLICATE KEY UPDATE message=VALUES(message)"
                : "INSERT INTO scan_logs (id, time_str, seat_id, row_name, seat_number, participant_name, status, message)
                   VALUES (:id, :time_str, :seat_id, :row_name, :seat_number, :participant_name, :status, :message)
                   ON CONFLICT(id) DO UPDATE SET message=excluded.message";

            $stmtL = $pdo->prepare($sqlL);
            $stmtL->execute([
                ':id' => $l['id'],
                ':time_str' => $l['time'],
                ':seat_id' => $l['seatId'],
                ':row_name' => $l['row'],
                ':seat_number' => (int)$l['number'],
                ':participant_name' => $l['participantName'],
                ':status' => $l['status'],
                ':message' => $l['message']
            ]);
        }

        // Recalculate assigned_seats_count for all participants
        $pdo->exec("
            UPDATE participants p SET assigned_seats_count = (
                SELECT COUNT(*) FROM seats s WHERE s.assigned_participant_id = p.id AND s.status != 'available'
            )
        ");

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'engine' => (defined('DB_TYPE') && DB_TYPE === 'mysql') ? 'mysql_phpmyadmin' : 'sqlite_database',
            'message' => 'Database synchronized successfully'
        ]);
        exit(0);

    } catch (Exception $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Database update error: ' . $e->getMessage()]);
        exit(1);
    }
}
