import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../common/errors.js';
import type { Service } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceInput, UpdateServiceInput } from './dto/service-input.js';

/** Tutor catalog of priced services (all operations scoped to the owner). */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(tutorId: string): Promise<Service[]> {
    return this.prisma.service.findMany({ where: { tutorId }, orderBy: { createdAt: 'asc' } });
  }

  create(tutorId: string, input: CreateServiceInput): Promise<Service> {
    return this.prisma.service.create({ data: { ...input, tutorId } });
  }

  /** Load a service, throwing 404 if missing or not the tutor's. */
  private async owned(id: string, tutorId: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (service === null || service.tutorId !== tutorId) {
      throw new EntityNotFoundError('Service', id);
    }
    return service;
  }

  async update(tutorId: string, input: UpdateServiceInput): Promise<Service> {
    await this.owned(input.id, tutorId);
    const { id, ...data } = input;
    return this.prisma.service.update({ where: { id }, data });
  }

  async setActive(tutorId: string, id: string, isActive: boolean): Promise<Service> {
    await this.owned(id, tutorId);
    return this.prisma.service.update({ where: { id }, data: { isActive } });
  }

  async remove(tutorId: string, id: string): Promise<boolean> {
    await this.owned(id, tutorId);
    await this.prisma.service.delete({ where: { id } });
    return true;
  }
}
