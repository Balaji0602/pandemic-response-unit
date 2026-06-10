INSERT INTO inventory (item_name, count)
VALUES ('Pfizer-Batch-A', 500)
ON CONFLICT (item_name) DO NOTHING;
