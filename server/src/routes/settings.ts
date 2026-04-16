import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get settings for current company
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirkete bağlı değilsiniz' });

    let settings = await prisma.appSettings.findUnique({ where: { companyId } });
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { companyId } });
    }
    res.json(settings);
  } catch (error) {
    console.error('API Settings Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

// Update settings for current company
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirkete bağlı değilsiniz' });

    const { id, updatedAt, companyId: _cid, company: _c, ...settingsData } = req.body;
    
    // Sadece modele ait alanları filtrelenmiş veriden al (Prisma hatasını engellemek için)
    const filteredData: any = {};
    const validFields = [
      'language', 'timezone', 'dataRetentionMonths', 'autoBackup', 'theme',
      'tableDensity', 'animationsEnabled', 'notificationsEnabled', 'twoFactorEnabled',
      'ipRestrictionEnabled', 'allowSupportAccess', 'sapIntegrationEnabled', 'webhooksEnabled',
      'colorMode', 'dashboardLayout', 'referenceLocationId', 'standardShiftIds',
      'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpFrom'
    ];
    
    validFields.forEach(field => {
      if (settingsData[field] !== undefined) {
        filteredData[field] = settingsData[field];
      }
    });

    console.log(`[Settings] Updating settings for company: ${companyId}`);
    
    const settings = await prisma.appSettings.upsert({
      where: { companyId },
      update: filteredData,
      create: { ...filteredData, companyId }
    });
    res.json(settings);
  } catch (error: any) {
    console.error('[Settings] Error updating settings:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message
    });
  }
});

// Export all company data
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirkete bağlı değilsiniz' });

    console.log(`[Settings] Exporting data for company: ${companyId}`);

    const [
      company, machines, operators, shifts, departments, roles, products, records, settings, overtime, imports
    ] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.machine.findMany({ where: { companyId } }),
      prisma.operator.findMany({ where: { companyId } }),
      prisma.shift.findMany({ where: { companyId } }),
      prisma.department.findMany({ where: { companyId } }),
      prisma.departmentRole.findMany({ where: { companyId } }),
      prisma.product.findMany({ where: { companyId } }),
      prisma.productionRecord.findMany({ where: { companyId }, include: { machine: true, product: true, shift: true, operator: true } }),
      prisma.appSettings.findUnique({ where: { companyId } }),
      prisma.overtimePlan.findMany({ where: { companyId }, include: { items: true } }),
      prisma.importHistory.findMany({ where: { companyId } }),
    ]);

    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        companyId,
        companyName: company?.name
      },
      data: {
        company,
        machines,
        operators,
        shifts,
        departments,
        roles,
        products,
        records,
        settings,
        overtime,
        imports
      }
    };

    res.header('Content-Type', 'application/json');
    res.attachment(`sosturer_export_${companyId}_${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error: any) {
    console.error('[Settings] Error exporting data:', error);
    res.status(500).json({ error: 'Export failed', message: error.message });
  }
});

export default router;
