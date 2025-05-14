-- Create timetable_history table
CREATE TABLE IF NOT EXISTS timetable_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    course VARCHAR(255) NOT NULL,
    day VARCHAR(255) NOT NULL,
    8_9_AM VARCHAR(255),
    9_10_AM VARCHAR(255),
    10_11_AM VARCHAR(255),
    11_30_12_30_PM VARCHAR(255),
    12_30_1_30_PM VARCHAR(255),
    1_30_2_30_PM VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for faster queries
CREATE INDEX idx_date ON timetable_history(date);
CREATE INDEX idx_course ON timetable_history(course);
CREATE INDEX idx_day ON timetable_history(day);