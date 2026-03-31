"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Veritabanı temizleniyor ve test verileri ekleniyor...');
    // Temizleme (Dependency order'a dikkat - sondan başa)
    try {
        await prisma.productionRecord.deleteMany();
        await prisma.product.deleteMany();
        await prisma.shift.deleteMany();
        await prisma.operator.deleteMany();
        await prisma.machine.deleteMany();
        await prisma.user.deleteMany();
    }
    catch (e) {
        console.log('Temizleme hatası, tablolar zaten boş olabilir.', e);
    }
    // 0. Kullanıcılar (Users)
    console.log('📦 Kullanicilar yukleniyor...');
    const salt = await bcryptjs_1.default.genSalt(10);
    const hashedPassword = await bcryptjs_1.default.hash('admin', salt);
    await prisma.user.create({
        data: {
            email: 'admin@neyesem.com',
            password: hashedPassword,
            fullName: 'Sistem Yöneticisi',
            role: 'admin',
            status: 'active'
        }
    });
    // 1. Vardiyalar (Shifts)
    console.log('📦 Vardiyalar yükleniyor...');
    const shift1 = await prisma.shift.create({
        data: { shiftCode: 'V-01', shiftName: 'Sabah Vardiyası', startTime: '08:00', endTime: '16:00', durationMinutes: 480, colorCode: '#3b82f6' }
    });
    const shift2 = await prisma.shift.create({
        data: { shiftCode: 'V-02', shiftName: 'Akşam Vardiyası', startTime: '16:00', endTime: '00:00', durationMinutes: 480, colorCode: '#8b5cf6' }
    });
    const shift3 = await prisma.shift.create({
        data: { shiftCode: 'V-03', shiftName: 'Gece Vardiyası', startTime: '00:00', endTime: '08:00', durationMinutes: 480, colorCode: '#1e40af' }
    });
    // 2. Tezgahlar (Machines)
    console.log('📦 Tezgahlar yükleniyor...');
    const cnc1 = await prisma.machine.create({
        data: { code: 'CNC-001', name: 'Mazak Integrex 1', brand: 'Mazak', model: 'i-200' }
    });
    const cnc2 = await prisma.machine.create({
        data: { code: 'CNC-002', name: 'DMG Mori NHX', brand: 'DMG Mori', model: 'NHX 4000' }
    });
    const cnc3 = await prisma.machine.create({
        data: { code: 'CNC-003', name: 'Doosan Puma', brand: 'Doosan', model: 'Puma 2600' }
    });
    const cnc4 = await prisma.machine.create({
        data: { code: 'CNC-004', name: 'Brother Speedio', brand: 'Brother', model: 'S700X1' }
    });
    const cnc5 = await prisma.machine.create({
        data: { code: 'CNC-005', name: 'Okuma Genos', brand: 'Okuma', model: 'M560-V' }
    });
    // 3. Operatörler (Operators)
    console.log('📦 Operatörler yükleniyor...');
    const op1 = await prisma.operator.create({ data: { employeeId: 'OP-101', fullName: 'Ahmet Yılmaz', department: 'Talaşlı İmalat', experienceYears: 5 } });
    const op2 = await prisma.operator.create({ data: { employeeId: 'OP-102', fullName: 'Mehmet Demir', department: 'Talaşlı İmalat', experienceYears: 8 } });
    const op3 = await prisma.operator.create({ data: { employeeId: 'OP-103', fullName: 'Ali Kaya', department: 'Talaşlı İmalat', experienceYears: 3 } });
    const op4 = await prisma.operator.create({ data: { employeeId: 'OP-104', fullName: 'Ayşe Öztürk', department: 'Kalite', experienceYears: 4 } });
    const op5 = await prisma.operator.create({ data: { employeeId: 'OP-105', fullName: 'Mustafa Çelik', department: 'Talaşlı İmalat', experienceYears: 12 } });
    // 4. Ürünler (Products)
    console.log('📦 Ürünler yükleniyor...');
    const p1 = await prisma.product.create({ data: { productCode: 'PRD-A100', productName: 'Flanş 100mm', unitOfMeasure: 'Adet', category: 'Otomotiv' } });
    const p2 = await prisma.product.create({ data: { productCode: 'PRD-A101', productName: 'Mil 50x200', unitOfMeasure: 'Adet', category: 'Otomotiv' } });
    const p3 = await prisma.product.create({ data: { productCode: 'PRD-B200', productName: 'Gövde Döküm', unitOfMeasure: 'Adet', category: 'Savunma' } });
    const p4 = await prisma.product.create({ data: { productCode: 'PRD-B201', productName: 'Kapak Alüminyum', unitOfMeasure: 'Adet', category: 'Beyaz Eşya' } });
    const p5 = await prisma.product.create({ data: { productCode: 'PRD-C300', productName: 'Piston 80mm', unitOfMeasure: 'Adet', category: 'Motor' } });
    // 5. Üretim Kayıtları (Production Records) - Son 3 gün
    console.log('📦 Üretim Kayıtları yükleniyor...');
    // Yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await prisma.productionRecord.create({
        data: {
            productionDate: yesterday,
            shiftId: shift1.id,
            machineId: cnc1.id,
            operatorId: op1.id,
            productId: p1.id,
            producedQuantity: 150,
            actualDurationMinutes: 76,
            cycleTimeSeconds: 148,
            plannedDurationMinutes: 370,
            plannedDowntimeMinutes: 0,
            unplannedDowntimeMinutes: 0,
            downtimeMinutes: 0,
            defectQuantity: 0,
            availability: 100.00,
            performance: 100,
            quality: 100.00,
            oee: 100
        }
    });
    await prisma.productionRecord.create({
        data: {
            productionDate: yesterday,
            shiftId: shift2.id,
            machineId: cnc2.id,
            operatorId: op2.id,
            productId: p2.id,
            producedQuantity: 100,
            actualDurationMinutes: 480,
            cycleTimeSeconds: 240,
            plannedDurationMinutes: 400,
            plannedDowntimeMinutes: 60,
            unplannedDowntimeMinutes: 0,
            downtimeMinutes: 60,
            defectQuantity: 2,
            availability: 85.00,
            performance: 83.33,
            quality: 98.00,
            oee: 69.41
        }
    });
    console.log('✅ Tohumlama (Seed) işlemi tamamlandı!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map