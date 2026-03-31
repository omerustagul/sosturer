import { Router } from 'express';
import { TemplateGeneratorService } from '../services/templateGeneratorService';
import type { ImportType } from '../excel/excelTypes';

const router = Router();

router.get('/:type', async (req, res) => {
  const type = String(req.params.type || '').toLowerCase() as ImportType;

  try {
    const workbook = await TemplateGeneratorService.generate(type);

    if (!workbook) return res.status(400).json({ error: `Template type not supported: ${type}` });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_template.xlsx`);

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ error: 'Template could not be generated.' });
  }
});

export default router;
