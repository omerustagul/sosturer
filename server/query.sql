SELECT id, productionDate, machineId, shiftId, cycleTimeSeconds, plannedQuantity, producedQuantity, oee 
FROM ProductionRecord 
WHERE productionDate LIKE '2026-01-05%' 
LIMIT 5;
