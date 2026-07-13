import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
    const users = [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Budi (Owner)', email: 'owner@resto.com', role: 'owner' as const, pin: '1234' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Siti (Kasir)', email: 'cashier@resto.com', role: 'cashier' as const, pin: '1111' },
        { id: '33333333-3333-4333-8333-333333333333', name: 'Agus (Chef)', email: 'chef@resto.com', role: 'chef' as const, pin: '2222' },
        { id: '44444444-4444-4444-8444-444444444444', name: 'Rudi (Admin)', email: 'admin@resto.com', role: 'admin' as const, pin: '3333' },
    ];

    for (const u of users) {
        const pinHash = await bcrypt.hash(u.pin, SALT_ROUNDS);
        const passwordHash = await bcrypt.hash(`${u.id}-dummy-password`, SALT_ROUNDS);

        await prisma.user.upsert({
            where: { id: u.id },
            update: { pinHash, name: u.name, role: u.role, isActive: true },
            create: {
                id: u.id,
                name: u.name,
                email: u.email,
                passwordHash,
                pinHash,
                role: u.role,
                isActive: true,
            },
        });
    }

    console.log('Seed selesai, 4 user siap dengan PIN login.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });