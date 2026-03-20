export interface Project {
  id?: number;
  name: string;
  client: string;
  base_rate: number;
  volatility_buffer: number; // 1.0 to 2.5
  currency: 'INR' | 'USD';
  include_gst: boolean;
  created_at?: string;
}

export interface Feature {
  id?: number;
  project_id: number;
  name: string;
  hours: number;
  multiplier: number;
  phase: 'UI/UX' | 'Development' | 'API' | 'QA' | 'Other';
}

interface StorageData {
  projects: Project[];
  features: Feature[];
}

export class StorageService {
  private data: StorageData = { projects: [], features: [] };
  private fileHandle: FileSystemFileHandle | null = null;

  async init() {}

  async openFile(handle: FileSystemFileHandle) {
    this.fileHandle = handle;
    const file = await handle.getFile();
    const text = await file.text();
    const fallback: StorageData = { projects: [], features: [] };
    
    if (!text || text.trim() === "") {
      this.data = fallback;
      return;
    }

    try {
      const parsed = JSON.parse(text);
      this.data = {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        features: Array.isArray(parsed.features) ? parsed.features : []
      };
    } catch (e) {
      console.error(e);
      this.data = fallback;
    }
  }

  async createNewFile(handle: FileSystemFileHandle) {
    this.fileHandle = handle;
    this.data = { projects: [], features: [] };
    await this.saveToFile();
  }

  async saveToFile() {
    if (!this.fileHandle) return;
    try {
      const writable = await (this.fileHandle as any).createWritable();
      await writable.write(JSON.stringify(this.data, null, 2));
      await writable.close();
    } catch (e) { throw e; }
  }

  async addProject(project: Omit<Project, 'id' | 'created_at'>): Promise<number> {
    const id = Date.now();
    const newProject: Project = { ...project, id, created_at: new Date().toISOString() };
    this.data.projects.push(newProject);
    await this.saveToFile();
    return id;
  }

  async updateProject(id: number, updates: Partial<Project>) {
    const index = this.data.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      this.data.projects[index] = { ...this.data.projects[index], ...updates };
      await this.saveToFile();
    }
  }

  async addFeature(feature: Omit<Feature, 'id'>) {
    const newFeature: Feature = { ...feature, id: Date.now() + Math.floor(Math.random() * 1000) };
    this.data.features.push(newFeature);
    await this.saveToFile();
  }

  async deleteFeature(id: number) {
    this.data.features = this.data.features.filter(f => f.id !== id);
    await this.saveToFile();
  }

  getProjects(): Project[] {
    return [...this.data.projects].sort((a, b) => {
       const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
       const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
       return dateB - dateA;
    });
  }

  getProjectFeatures(projectId: number): Feature[] {
    return this.data.features.filter(f => f.project_id === projectId);
  }

  async deleteProject(id: number) {
    this.data.projects = this.data.projects.filter(p => p.id !== id);
    this.data.features = this.data.features.filter(f => f.project_id !== id);
    await this.saveToFile();
  }
}

export const dbService = new StorageService();
