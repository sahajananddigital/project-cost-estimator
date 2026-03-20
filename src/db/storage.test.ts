import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './storage';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
    // Mock file handle and write logic since File System API is browser-only
    (service as any).fileHandle = {
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    };
  });

  it('should add a project and return its id', async () => {
    const project = {
      name: 'Test Project',
      client: 'Test Client',
      base_rate: 1000,
      volatility_buffer: 1.2,
      currency: 'INR' as const,
      include_gst: true,
    };

    const id = await service.addProject(project);
    expect(id).toBeDefined();
    expect(service.getProjects()).toHaveLength(1);
    expect(service.getProjects()[0].name).toBe('Test Project');
  });

  it('should add features to a project', async () => {
    const projectId = await service.addProject({
      name: 'P1', client: 'C1', base_rate: 1000, volatility_buffer: 1, currency: 'INR', include_gst: false
    });

    await service.addFeature({
      project_id: projectId,
      name: 'F1',
      hours: 10,
      multiplier: 1,
      phase: 'Development',
    });

    const features = service.getProjectFeatures(projectId);
    expect(features).toHaveLength(1);
    expect(features[0].name).toBe('F1');
  });

  it('should delete a project and its features', async () => {
    const id = await service.addProject({
      name: 'P1', client: 'C1', base_rate: 1000, volatility_buffer: 1, currency: 'INR', include_gst: false
    });
    
    await service.addFeature({ project_id: id, name: 'F1', hours: 5, multiplier: 1, phase: 'QA' });
    
    await service.deleteProject(id);
    expect(service.getProjects()).toHaveLength(0);
    expect(service.getProjectFeatures(id)).toHaveLength(0);
  });

  it('should update project properties', async () => {
    const id = await service.addProject({
      name: 'Old Name', client: 'C1', base_rate: 1000, volatility_buffer: 1, currency: 'INR', include_gst: false
    });

    await service.updateProject(id, { name: 'New Name' });
    expect(service.getProjects()[0].name).toBe('New Name');
  });
});
