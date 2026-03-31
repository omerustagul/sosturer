import { TemplateGeneratorService } from '../src/services/templateGeneratorService';
import fs from 'fs';
import path from 'path';

/**
 * Post-Migration Hook
 * This script is intended to run after database migrations to ensure all templates are up to date.
 */
async function main() {
  console.log('🔄 Post-migration hook başlatılıyor...');

  const importTypes = [
    'production_records',
    'products',
    'machines',
    'operators',
    'shifts',
    'production_standards'
  ];

  const templateDir = path.join(process.cwd(), 'public/templates');
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true });
  }

  for (const type of importTypes) {
    try {
      console.log(`📝 ${type} için şablon hazırlanıyor...`);
      const workbook = await TemplateGeneratorService.generate(type);
      
      const filePath = path.join(templateDir, `${type}_template.xlsx`);
      await workbook.xlsx.writeFile(filePath);
      
      console.log(`✅ Şablon güncellendi: ${filePath}`);
    } catch (error) {
      console.error(`❌ ${type} şablonu oluşturulurken hata:`, error);
    }
  }

  console.log('✨ Post-migration hook tamamlandı!');
}

main().catch(err => {
  console.error('Fatal error in post-migration hook:', err);
  process.exit(1);
});
