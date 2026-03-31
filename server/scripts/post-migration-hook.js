"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const templateGeneratorService_1 = require("../src/services/templateGeneratorService");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
    const templateDir = path_1.default.join(process.cwd(), 'public/templates');
    if (!fs_1.default.existsSync(templateDir)) {
        fs_1.default.mkdirSync(templateDir, { recursive: true });
    }
    for (const type of importTypes) {
        try {
            console.log(`📝 ${type} için şablon hazırlanıyor...`);
            const workbook = await templateGeneratorService_1.TemplateGeneratorService.generate(type);
            const filePath = path_1.default.join(templateDir, `${type}_template.xlsx`);
            await workbook.xlsx.writeFile(filePath);
            console.log(`✅ Şablon güncellendi: ${filePath}`);
        }
        catch (error) {
            console.error(`❌ ${type} şablonu oluşturulurken hata:`, error);
        }
    }
    console.log('✨ Post-migration hook tamamlandı!');
}
main().catch(err => {
    console.error('Fatal error in post-migration hook:', err);
    process.exit(1);
});
//# sourceMappingURL=post-migration-hook.js.map