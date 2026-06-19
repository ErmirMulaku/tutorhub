import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../common/errors.js';
import { Prisma, type Tutor } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTutorDto, WorkingHoursDto } from './dto/create-tutor.dto.js';
import type { UpdateTutorDto } from './dto/update-tutor.dto.js';

/** Plain JSON for the Prisma `Json` column (DTO instances lack an index signature). */
function toJsonWorkingHours(workingHours: WorkingHoursDto[]): Prisma.InputJsonValue {
  return workingHours.map((w) => ({ day: w.day, start: w.start, end: w.end }));
}

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTutorDto): Promise<Tutor> {
    return this.prisma.tutor.create({
      data: {
        name: dto.name,
        bio: dto.bio ?? null,
        timezone: dto.timezone,
        hourlyCents: dto.hourlyCents,
        isActive: dto.isActive ?? true,
        workingHours: toJsonWorkingHours(dto.workingHours),
      },
    });
  }

  findAll(): Promise<Tutor[]> {
    return this.prisma.tutor.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<Tutor> {
    const tutor = await this.prisma.tutor.findUnique({ where: { id } });
    if (tutor === null) {
      throw new EntityNotFoundError('Tutor', id);
    }
    return tutor;
  }

  async update(id: string, dto: UpdateTutorDto): Promise<Tutor> {
    await this.findOne(id);
    const data: Prisma.TutorUpdateInput = {
      name: dto.name,
      bio: dto.bio,
      timezone: dto.timezone,
      hourlyCents: dto.hourlyCents,
      isActive: dto.isActive,
    };
    if (dto.workingHours !== undefined) {
      data.workingHours = toJsonWorkingHours(dto.workingHours);
    }
    return this.prisma.tutor.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.tutor.delete({ where: { id } });
  }
}
