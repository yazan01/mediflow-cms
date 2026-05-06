import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateMRN(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 900000) + 100000;
  return `MRN-${year}-${random}`;
}

export function generateEmpCode(): string {
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `EMP-${random}`;
}

export function generateInvoiceNo(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `INV-${year}${month}-${random}`;
}

export function generatePONumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `PO-${year}-${random}`;
}

export async function logAudit(params: {
  userId: string;
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  oldValues?: object;
  newValues?: object;
  ipAddress?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      module: params.module,
      entityId: params.entityId,
      entityType: params.entityType,
      oldValues: params.oldValues ? JSON.stringify(params.oldValues) : undefined,
      newValues: params.newValues ? JSON.stringify(params.newValues) : undefined,
      ipAddress: params.ipAddress,
    },
  });
}
