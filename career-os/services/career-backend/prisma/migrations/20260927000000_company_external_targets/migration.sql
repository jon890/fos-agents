ALTER TABLE company_preferences
  MODIFY COLUMN tier TINYINT UNSIGNED NULL,
  MODIFY COLUMN disposition ENUM('analyze', 'exclude', 'benchmark') NOT NULL,
  ADD COLUMN dart_corp_code CHAR(8) NULL,
  ADD COLUMN blind_company_slug VARCHAR(191) NULL;
