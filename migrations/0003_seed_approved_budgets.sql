INSERT OR IGNORE INTO documents (id,title,document_type,government_id,year,issuing_authority,original_url,processing_status)
VALUES
('source-2017','Niger Assembly passes 2017 appropriation bill','Appropriation enactment','niger-state',2017,'Niger State House of Assembly','https://www.vanguardngr.com/2017/04/niger-assembly-passes-2017-appropriation-bill/','source-linked'),
('source-2018','Niger State 2018 Approved Budget','Approved budget','niger-state',2018,'Niger State Government','https://yourbudgit.com/wp-content/uploads/2020/02/2018-Niger-State-approved-budget.pdf','source-linked'),
('source-2019','Niger State 2019 Approved Budget','Approved budget','niger-state',2019,'Niger State Government','https://s3.eu-west-2.amazonaws.com/openstates.ng.storage/documents/dataset_NIGER-STATE-APPROVED-2019-BUDGET.pdf','source-linked'),
('source-2020','Niger State 2020 Approved Budget','Approved budget','niger-state',2020,'Niger State Government','https://nigerstate.gov.ng/wp-content/uploads/2020/03/NIGER-STATE-APPROVED-2020-BUDGET.pdf','source-linked'),
('source-2021','Niger State 2021 Approved Budget','Approved budget','niger-state',2021,'Niger State Government','https://s3.eu-west-2.amazonaws.com/openstates.ng.storage/documents/dataset_NIGER-STATE-2021-APPROVED-BUDGET.pdf','source-linked'),
('source-2022','Governor signs 2022 budget of ₦211bn','Appropriation enactment','niger-state',2022,'Niger State Government','https://thenationonlineng.net/niger-governor-signs-2022-budget-of-n211b/','source-linked'),
('source-2023','Niger State Governor signs 2023 budget into law','Appropriation enactment','niger-state',2023,'Niger State Government','https://von.gov.ng/niger-state-governor-signs-2023-budget-into-law/','source-linked'),
('source-2024','Niger State 2024 Approved Budget','Approved budget','niger-state',2024,'Niger State Government','https://nogp.nigerstate.gov.ng/wp-content/uploads/NIGER-STATE-APPROVED-2024-BUDGET.pdf','source-linked'),
('source-2025','Niger State 2025 Approved Budget','Approved budget','niger-state',2025,'Niger State Government','https://nspc.nigerstate.gov.ng/wp-content/uploads/2025/05/Approved-Budget-2025-Traditional.pdf','source-linked'),
('source-2026','Niger State 2026 approved appropriation','Appropriation enactment','niger-state',2026,'Niger State House of Assembly','https://tribuneonlineng.com/niger-assembly-passes-n1-073trn-2026-budget/','source-linked');

INSERT OR IGNORE INTO budgets (id,government_id,budget_year,title,total_budget,capital_expenditure,recurrent_expenditure,source_document_id,status)
VALUES
('budget-2017','niger-state',2017,'2017 Approved Budget',116196000000,0,0,'source-2017','Approved'),
('budget-2018','niger-state',2018,'2018 Approved Budget',134286417019,0,0,'source-2018','Approved'),
('budget-2019','niger-state',2019,'2019 Approved Budget',164450868735,0,0,'source-2019','Approved'),
('budget-2020','niger-state',2020,'2020 Approved Budget',155459814700.82,0,0,'source-2020','Approved'),
('budget-2021','niger-state',2021,'2021 Approved Budget',153412621776.37,0,0,'source-2021','Approved'),
('budget-2022','niger-state',2022,'2022 Approved Budget',211000000000,0,0,'source-2022','Approved'),
('budget-2023','niger-state',2023,'2023 Approved Budget',243000000000,0,0,'source-2023','Approved'),
('budget-2024','niger-state',2024,'2024 Approved Budget',613994801697,0,0,'source-2024','Approved'),
('budget-2025','niger-state',2025,'2025 Approved Budget',1558887565358.21,0,0,'source-2025','Approved'),
('budget-2026','niger-state',2026,'2026 Approved Budget',1073991335895,0,0,'source-2026','Approved');
