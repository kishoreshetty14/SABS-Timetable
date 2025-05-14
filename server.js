const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
const PORT = 5004;

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: "hopper.proxy.rlwy.net",   
    port: 26036,                      
    user: "root",                     
    password: "NFgBQAasPKmFSqJEiPOkKvdnOMVsMMGo",   
    database: "railway"     
});

db.connect(err => {
    if (err) {
        console.error("❌ Database connection failed:", err);
    } else {
        console.log("✅ Connected to MySQL");
    }
});

app.post("/api/staff-login", (req, res) => {
    const { passcode } = req.body;

    const sql = "SELECT * FROM staff WHERE passcode = ?";
    db.query(sql, [passcode], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.length > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    });
});

app.post("/api/admin-login", (req, res) => {
    const { passcode } = req.body;

    if (!passcode) {
        return res.status(400).json({ error: "Passcode is required" });
    }

    const sql = "SELECT * FROM admin WHERE passcode = ?";
    db.query(sql, [passcode], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            res.status(500).json({ error: "Database query failed" });
            return;
        }

        if (results.length > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    });
});

function clearOldSuggestions() {
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];

    console.log(`🔄 Checking if suggestions need to be cleared for ${currentDate}...`);

    db.query("SELECT value FROM system_settings WHERE name = 'last_cleared_date'", (err, result) => {
        if (err) {
            console.error("❌ Error checking last cleared date:", err);
            return;
        }

        const lastClearedDate = result.length > 0 ? result[0].value : null;

        if (lastClearedDate !== currentDate) {
            console.log("🗑️ New day detected! Clearing old suggestions...");

            db.query("DELETE FROM suggestions", (deleteErr) => {
                if (deleteErr) {
                    console.error("❌ Error clearing old suggestions:", deleteErr);
                } else {
                    console.log("✅ Old suggestions cleared!");

                    db.query(
                        "INSERT INTO system_settings (name, value) VALUES ('last_cleared_date', ?) ON DUPLICATE KEY UPDATE value = ?",
                        [currentDate, currentDate]
                    );
                }
            });
        } else {
            console.log("✅ Suggestions already cleared for today.");
        }
    });
}

clearOldSuggestions();
setInterval(clearOldSuggestions, 60000);

app.post("/api/suggestions", (req, res) => {
    const { staff_name, message } = req.body;

    if (!staff_name || !message) {
        return res.status(400).json({ error: "Name and message cannot be empty" });
    }

    const sql = "INSERT INTO suggestions (staff_name, message) VALUES (?, ?)";
    db.query(sql, [staff_name, message], (err, result) => {
        if (err) {
            console.error("❌ Error saving suggestion:", err);
            res.status(500).json({ error: "Database insert failed" });
        } else {
            res.json({ message: "✅ Suggestion submitted successfully!" });
        }
    });
});

app.get("/api/suggestions", (req, res) => {
    db.query("SELECT * FROM suggestions", (err, results) => {
        if (err) {
            console.error("❌ Error fetching suggestions:", err);
            res.status(500).json({ error: "Database query failed" });
        } else {
            res.json(results);
        }
    });
});

app.get("/api/timetable/today", (req, res) => {
    const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const sql = "SELECT * FROM daily_timetable WHERE day = ?";

    db.query(sql, [currentDay], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            res.status(500).json({ error: "Database query failed" });
        } else {
            res.json(results);
        }
    });
});

function resetDailyTimetable() {
    const today = new Date().toISOString().split("T")[0];
    console.log("🔄 Checking if daily timetable needs reset...");

    db.query("SELECT value FROM system_settings WHERE name = 'last_timetable_reset'", (err, result) => {
        if (err) {
            console.error("❌ Error checking last_timetable_reset:", err);
            return;
        }

        const lastReset = result.length > 0 ? result[0].value : null;

        if (lastReset === today) {
            console.log("✅ Already reset today. Skipping...");
            return;
        }

        storeTimetableHistory().then(() => {
            db.query("DELETE FROM daily_timetable", (err) => {
                if (err) {
                    console.error("❌ Error clearing daily_timetable:", err);
                    return;
                }
                console.log("✅ daily_timetable cleared!");

                db.query("ALTER TABLE daily_timetable AUTO_INCREMENT = 1", (err) => {
                    if (err) {
                        console.error("❌ Error resetting AUTO_INCREMENT:", err);
                        return;
                    }
                    console.log("🔄 AUTO_INCREMENT reset to 1");

                    const copySql = `
                        INSERT INTO daily_timetable (course, day, 8_9_AM, 9_10_AM, 10_11_AM, 11_30_12_30_PM, 12_30_1_30_PM, 1_30_2_30_PM)
                        SELECT course, day, 8_9_AM, 9_10_AM, 10_11_AM, 11_30_12_30_PM, 12_30_1_30_PM, 1_30_2_30_PM FROM master_timetable
                    `;
                    db.query(copySql, (err) => {
                        if (err) {
                            console.error("❌ Error copying from master_timetable:", err);
                            return;
                        }
                        console.log("✅ Copied from master_timetable!");

                        db.query(`
                            INSERT INTO system_settings (name, value)
                            VALUES ('last_timetable_reset', ?)
                            ON DUPLICATE KEY UPDATE value = ?
                        `, [today, today], (err) => {
                            if (err) {
                                console.error("❌ Failed to update last_timetable_reset:", err);
                            } else {
                                console.log("📅 Updated last_timetable_reset to", today);
                            }
                        });
                    });
                });
            });
        });
    });
}

resetDailyTimetable();
setInterval(resetDailyTimetable, 60000);

app.put("/api/timetable", (req, res) => {
    console.log("📩 Received Data:", JSON.stringify(req.body, null, 2));

    const updatedTimetable = req.body;

    updatedTimetable.forEach(row => {
        const { id, ...columns } = row;
        const columnNames = Object.keys(columns);
        const columnValues = Object.values(columns);

        let query = `UPDATE daily_timetable SET ${columnNames.map(col => `${col} = ?`).join(", ")} WHERE id = ?`;
        let values = [...columnValues, id];

        db.query(query, values, (err, result) => {
            if (err) {
                console.error("❌ Error updating timetable:", err);
                res.status(500).json({ error: "Database update failed" });
                return;
            }
        });
    });

    res.json({ message: "✅ Timetable updated successfully!" });
});

app.get("/api/timetable/course/:courseName", (req, res) => {
    const courseName = req.params.courseName.replace(/-/g, " ");
    const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const sql = "SELECT * FROM daily_timetable WHERE course = ? AND day = ?";

    db.query(sql, [courseName, currentDay], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            res.status(500).json({ error: "Database query failed" });
        } else {
            res.json(results);
        }
    });
});

app.get("/api/timetable/history", (req, res) => {
    const { date } = req.query;
    let sql = "SELECT * FROM timetable_history";
    let params = [];

    if (date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                error: "Invalid date format. Please use YYYY-MM-DD format.",
                success: false
            });
        }
        sql += " WHERE date = ?";
        params.push(date);
    }

    sql += " ORDER BY date DESC, course ASC";

    db.query({ sql, timeout: 10000 }, params, (err, results) => {
        if (err) {
            console.error("❌ Error fetching timetable history:", err);
            return res.status(500).json({
                error: "Failed to fetch timetable history. Please try again.",
                success: false,
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }

        res.json({
            success: true,
            data: results,
            count: results.length,
            message: results.length > 0 ? "Timetable history retrieved successfully" : "No history found for the specified criteria"
        });
    });
});

function storeTimetableHistory() {
    const today = new Date().toISOString().split("T")[0];
    const sql = `
        INSERT INTO timetable_history (date, course, day, 8_9_AM, 9_10_AM, 10_11_AM, 11_30_12_30_PM, 12_30_1_30_PM, 1_30_2_30_PM)
        SELECT ?, course, day, 8_9_AM, 9_10_AM, 10_11_AM, 11_30_12_30_PM, 12_30_1_30_PM, 1_30_2_30_PM
        FROM daily_timetable
    `;
    return new Promise((resolve, reject) => {
        db.query(sql, [today], (err) => {
            if (err) {
                console.error("❌ Error storing timetable history:", err);
                reject(err);
            } else {
                console.log("✅ Timetable history stored for", today);
                resolve();
            }
        });
    });
}

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});