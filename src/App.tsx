import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Download, FilePlus, Database, ChevronRight, 
  AlertCircle, RefreshCw, Layers, Briefcase, Users, 
  Settings, Trash2, Layout, Zap, CheckCircle, Info, 
  DollarSign, Percent
} from 'lucide-react';
import { dbService } from './db/storage';
import type { Project, Feature } from './db/storage';
import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';
import './index.css';

const PRESETS: Omit<Feature, 'id' | 'project_id'>[] = [
  { name: 'User Authentication (Firebase/Auth0)', hours: 12, multiplier: 1, phase: 'API' },
  { name: 'Payment Gateway Integration', hours: 8, multiplier: 1, phase: 'API' },
  { name: 'Admin Dashboard & Analytics', hours: 24, multiplier: 1, phase: 'Development' },
  { name: 'REST API Development (per entity)', hours: 6, multiplier: 1, phase: 'API' },
  { name: 'UI Implementation (Tailwind/React)', hours: 8, multiplier: 1, phase: 'UI/UX' },
  { name: 'QA & Unit Testing', hours: 10, multiplier: 1, phase: 'QA' },
];

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [saveStatus, setSaveStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState<Omit<Project, 'id' | 'created_at'>>({ 
    name: '', client: '', base_rate: 1500, volatility_buffer: 1.2, currency: 'INR', include_gst: true 
  });
  const [newFeature, setNewFeature] = useState<Omit<Feature, 'id' | 'project_id'>>({ 
    name: '', hours: 0, multiplier: 1.0, phase: 'Development' 
  });

  const saveTimeout = useRef<any>(null);

  useEffect(() => {
    dbService.init().then(() => setDbReady(true));
  }, []);

  const handleConnectDb = async () => {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
      });
      await dbService.openFile(handle);
      refreshProjects();
    } catch (e) { console.error(e); }
  };

  const handleCreateDb = async () => {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: 'sahajanand_estimates.json',
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
      });
      await dbService.createNewFile(handle);
      refreshProjects();
    } catch (e) { console.error(e); }
  };

  const refreshProjects = () => {
    const allProjects = dbService.getProjects();
    setProjects(allProjects);
    if (activeProject) {
      const updated = allProjects.find(p => p.id === activeProject.id);
      if (updated) {
        setActiveProject(updated);
        setFeatures(dbService.getProjectFeatures(updated.id!));
      }
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    const id = await dbService.addProject(newProject);
    refreshProjects();
    setShowNewProject(false);
    selectProject({ ...newProject, id, created_at: new Date().toISOString() });
    setSaveStatus('synced');
  };

  const selectProject = (project: Project) => {
    setActiveProject(project);
    setFeatures(dbService.getProjectFeatures(project.id!));
  };

  const handleAddFeature = async (e: React.FormEvent | Omit<Feature, 'id' | 'project_id'>) => {
    if ('preventDefault' in e) e.preventDefault();
    if (!activeProject?.id) return;
    
    setSaveStatus('saving');
    const featureData = 'name' in e ? e : newFeature;
    await dbService.addFeature({ ...featureData, project_id: activeProject.id });
    setFeatures(dbService.getProjectFeatures(activeProject.id));
    setNewFeature({ name: '', hours: 0, multiplier: 1.0, phase: 'Development' });
    setSaveStatus('synced');
  };

  const handleDeleteFeature = async (id: number) => {
    if (!activeProject?.id) return;
    setSaveStatus('saving');
    await dbService.deleteFeature(id);
    setFeatures(dbService.getProjectFeatures(activeProject.id));
    setSaveStatus('synced');
  };

  const handleUpdateProject = async (updates: Partial<Project>) => {
    if (!activeProject?.id) return;
    setActiveProject(prev => prev ? { ...prev, ...updates } : null);
    
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaveStatus('saving');
      await dbService.updateProject(activeProject!.id!, updates);
      setSaveStatus('synced');
    }, 500);
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Permanently delete this project architecture?')) return;
    setSaveStatus('saving');
    await dbService.deleteProject(id);
    setActiveProject(null);
    refreshProjects();
    setSaveStatus('synced');
  };

  const totals = useMemo(() => {
    const rawHours = features.reduce((acc, f) => acc + (f.hours * f.multiplier), 0);
    const bufferedHours = rawHours * (activeProject?.volatility_buffer || 1.0);
    const baseCost = bufferedHours * (activeProject?.base_rate || 0);
    const gst = activeProject?.include_gst ? baseCost * 0.18 : 0;
    return { rawHours, bufferedHours, baseCost, gst, total: baseCost + gst };
  }, [features, activeProject]);

  const currencySymbol = activeProject?.currency === 'USD' ? '$' : '₹';

  const exportPDF = async () => {
    const element = document.getElementById('estimate-preview');
    if (!element || !active) return;
    
    try {
      setSaveStatus('saving');
      console.log('Generating PDF...');
      
      const canvas = await toCanvas(element, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      
      const fileName = `${active.name.replace(/[^a-z0-9]/gi, '_')}_Proposal.pdf`;
      pdf.save(fileName);
      
      setSaveStatus('synced');
      console.log('PDF saved successfully');
    } catch (error) {
      console.error('PDF Export failed:', error);
      setSaveStatus('error');
      alert('Failed to generate PDF. Modern CSS (oklch) might be causing issues with the renderer. Check console.');
    }
  };

  if (!dbReady) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-4" />
      <span className="font-bold text-xl tracking-tight text-center uppercase">Sahajanand Engine Initializing...</span>
    </div>
  );

  const active = activeProject;

  return (
    <div className="app-container font-sans flex h-screen overflow-hidden bg-slate-50 text-left">
      {/* SIDEBAR */}
      <aside className="w-80 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 shadow-2xl z-20">
        <div className="p-8 border-b border-slate-900 bg-slate-950/50 backdrop-blur-xl">
          <div className="text-xl font-black tracking-tighter text-white text-left">SAHAJANAND <span className="text-blue-500 text-left">DIGITAL</span></div>
          <div className="text-[10px] font-bold text-slate-500 tracking-[0.3em] uppercase mt-1 text-left">Product Architect v3.0</div>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-8">
          <div className="space-y-2">
             <button onClick={handleConnectDb} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-900 transition-all text-sm font-medium border border-transparent hover:border-slate-800 text-left">
               <Database className="w-4 h-4 text-blue-500"/> Open Estimates
             </button>
             <button onClick={handleCreateDb} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-900 transition-all text-sm font-medium border border-transparent hover:border-slate-800 text-left">
               <FilePlus className="w-4 h-4 text-emerald-500"/> New Collection
             </button>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Active Projects</span>
              <button onClick={() => { setActiveProject(null); setShowNewProject(true); }} className="p-1.5 bg-blue-600 rounded-lg text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all text-center">
                <Plus size={14}/>
              </button>
            </div>
            <nav className="space-y-1">
              {projects.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
                  <p className="text-[10px] font-bold text-slate-600 uppercase">Library Empty</p>
                </div>
              ) : projects.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => selectProject(p)}
                  className={`group w-full flex items-center justify-between p-3 rounded-xl text-sm transition-all border ${active?.id === p.id ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-900 border-transparent text-slate-400'}`}
                >
                  <span className="truncate font-semibold text-left">{p.name}</span>
                  <ChevronRight size={14} className={`${active?.id === p.id ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="p-6 border-t border-slate-900 bg-slate-950/80">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cloud Sync</div>
            <div className="flex items-center gap-2">
              {saveStatus === 'synced' && <CheckCircle size={14} className="text-emerald-500"/>}
              {saveStatus === 'saving' && <RefreshCw size={14} className="text-blue-500 animate-spin"/>}
              {saveStatus === 'error' && <AlertCircle size={14} className="text-rose-500"/>}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 overflow-y-auto scroll-smooth">
        {!active && !showNewProject ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-6">
            <div className="relative group text-center">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000 text-center"></div>
              <div className="relative bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 text-center">
                <Layout size={80} className="text-blue-600 text-center" />
              </div>
            </div>
            <div className="max-w-md space-y-4 text-center">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight text-center">Architecture Begins with Precision.</h2>
              <p className="text-slate-500 font-medium text-lg leading-relaxed text-center">
                Sahajanand's professional estimator provides deep insights into your project costs while protecting your time.
              </p>
            </div>
            <button onClick={() => setShowNewProject(true)} className="btn btn-primary px-10 py-4 text-lg rounded-2xl text-center">
              Start New Architecture
            </button>
          </div>
        ) : showNewProject ? (
          <div className="max-w-3xl mx-auto p-12 animate-in fade-in slide-in-from-bottom-4 text-left">
             <div className="card p-10 space-y-8 relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 text-left"></div>
                <div className="relative text-left">
                  <h2 className="text-3xl font-black text-slate-900 mb-2 text-left">Project Foundation</h2>
                  <p className="text-slate-500 font-medium text-left">Define the core parameters for your next digital venture.</p>
                </div>
                
                <form onSubmit={handleAddProject} className="relative space-y-8 text-left">
                   <div className="grid grid-cols-2 gap-8 text-left">
                      <div className="space-y-2 text-left">
                         <label className="label">Project Identity</label>
                         <input required className="input" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="e.g. Neo-Bank Mobile App" />
                      </div>
                      <div className="space-y-2 text-left">
                         <label className="label">Client Entity</label>
                         <input required className="input" value={newProject.client} onChange={e => setNewProject({...newProject, client: e.target.value})} placeholder="e.g. Standard Chartered" />
                      </div>
                      <div className="space-y-2 text-left">
                         <label className="label">Base Hourly Rate ({newProject.currency === 'INR' ? '₹' : '$'})</label>
                         <input type="number" className="input" value={newProject.base_rate} onChange={e => setNewProject({...newProject, base_rate: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2 text-left">
                         <label className="label">Operating Currency</label>
                         <select className="input appearance-none" value={newProject.currency} onChange={e => setNewProject({...newProject, currency: e.target.value as any})}>
                            <option value="INR">Indian Rupee (₹)</option>
                            <option value="USD">US Dollar ($)</option>
                         </select>
                      </div>
                   </div>
                   
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-left">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 text-center">
                          <Percent size={20} className="text-blue-600 text-center"/>
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-slate-900 text-left">Include GST (18%)</div>
                          <div className="text-xs text-slate-500 font-medium text-left">Automatically add tax for Indian invoices.</div>
                        </div>
                      </div>
                      <input type="checkbox" className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500 cursor-pointer" checked={newProject.include_gst} onChange={e => setNewProject({...newProject, include_gst: e.target.checked})} />
                   </div>

                   <div className="flex gap-4 pt-4 text-left">
                      <button type="submit" className="btn btn-primary flex-1 py-4 text-center">Initialize Project Architecture</button>
                      <button type="button" onClick={() => setShowNewProject(false)} className="btn btn-secondary px-8 text-center">Discard</button>
                   </div>
                </form>
             </div>
          </div>
        ) : (active && (
          <div className="p-12 animate-in fade-in duration-500 text-left">
            <div className="max-w-[1100px] mx-auto space-y-12 text-left">
               {/* PROJECT HEADER */}
               <div className="flex justify-between items-end pb-8 border-b border-slate-200 text-left">
                  <div className="space-y-2 text-left">
                     <div className="flex items-center gap-3 text-left">
                        <h2 className="text-5xl font-black text-slate-900 tracking-tighter text-left">{active.name}</h2>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg uppercase tracking-wider text-center">Proprietary</span>
                     </div>
                     <div className="flex items-center gap-6 text-slate-500 font-bold text-sm tracking-wide text-left">
                        <span className="flex items-center gap-2 text-left"><Users size={16} className="text-slate-400 text-left"/> {active.client}</span>
                        <span className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-left"><Briefcase size={16} className="text-blue-600 text-left"/> {active.currency} • {currencySymbol}{active.base_rate}/hr</span>
                     </div>
                  </div>
                  <div className="flex gap-3 no-pdf text-right">
                     <button onClick={exportPDF} className="btn btn-primary h-14 px-8 rounded-2xl shadow-xl shadow-blue-500/30 text-center">
                        <Download size={20} className="text-white text-center"/> Download Proposal
                     </button>
                     <button onClick={() => handleDeleteProject(active.id!)} className="btn btn-secondary w-14 h-14 rounded-2xl bg-white border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 shadow-sm transition-all text-center">
                        <Trash2 size={20} className="text-rose-500 text-center"/>
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-12 gap-10 text-left">
                  <div className="col-span-8 space-y-10 text-left">
                     {/* COMPONENT BUILDER */}
                     <div className="card p-8 border-l-4 border-l-blue-600 text-left">
                        <div className="flex items-center justify-between mb-8 text-left">
                          <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight text-left">
                            <Layers className="text-blue-600 text-left"/> Estimate Builder
                          </h3>
                        </div>
                        <form onSubmit={handleAddFeature} className="space-y-6 text-left">
                           <div className="grid grid-cols-12 gap-6 items-end text-left">
                              <div className="col-span-6 space-y-2 text-left">
                                 <label className="label">Component Definition</label>
                                 <input required className="input" value={newFeature.name} onChange={e => setNewFeature({...newFeature, name: e.target.value})} placeholder="e.g. Core System Design" />
                              </div>
                              <div className="col-span-3 space-y-2 text-left">
                                 <label className="label">Est. Hours</label>
                                 <input type="number" required className="input" value={newFeature.hours} onChange={e => setNewFeature({...newFeature, hours: Number(e.target.value)})} />
                              </div>
                              <div className="col-span-3 space-y-2 text-left">
                                 <label className="label">Product Phase</label>
                                 <select className="input appearance-none" value={newFeature.phase} onChange={e => setNewFeature({...newFeature, phase: e.target.value as any})}>
                                    <option value="UI/UX">UI/UX Design</option>
                                    <option value="Development">Development</option>
                                    <option value="API">API/Backend</option>
                                    <option value="QA">Quality Assurance</option>
                                    <option value="Other">Miscellaneous</option>
                                 </select>
                              </div>
                           </div>
                           <button type="submit" className="w-full btn btn-primary py-4 rounded-2xl text-center">
                             Integrate into Scope
                           </button>
                        </form>
                        
                        <div className="mt-8 pt-8 border-t border-slate-100 text-left">
                           <div className="flex items-center gap-2 mb-4 text-left">
                             <Zap size={14} className="text-amber-500 text-left"/>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Architecture Templates</span>
                           </div>
                           <div className="flex flex-wrap gap-2 text-left">
                              {PRESETS.map(p => (
                                 <button 
                                   key={p.name}
                                   onClick={() => handleAddFeature(p)}
                                   className="text-[10px] font-black bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-950 hover:text-white transition-all border border-slate-200 hover:border-slate-950 flex items-center gap-2 text-left"
                                 >
                                   {p.name} <span className="text-blue-500">+{p.hours}h</span>
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     {/* BREAKDOWN TABLE */}
                     <div className="card overflow-hidden shadow-2xl text-left" id="estimate-preview">
                        <div className="p-12 border-b-8 border-slate-900 bg-slate-50 text-left">
                           <div className="flex justify-between items-start text-left">
                              <div className="text-left">
                                 <div className="text-2xl font-black tracking-tighter text-slate-900 text-left">SAHAJANAND <span className="text-blue-600 text-left">DIGITAL</span></div>
                                 <div className="text-[10px] font-black text-slate-500 mt-1 uppercase tracking-widest text-left">Technological Partnership Proposal</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 text-right">Created for</div>
                                 <div className="text-lg font-black text-slate-900 text-right">{active.client}</div>
                              </div>
                           </div>
                        </div>

                        <div className="p-12 space-y-12 text-left">
                          <table className="w-full text-left">
                             <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100 text-left">
                                   <th className="pb-4 text-left">Phase & Component</th>
                                   <th className="pb-4 text-center">Architectural Hours</th>
                                   <th className="pb-4 text-right">Investment ({active.currency})</th>
                                   <th className="pb-4 no-pdf text-right"></th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100 text-left">
                                {features.map(f => (
                                   <tr key={f.id} className="group text-left">
                                      <td className="py-6 text-left">
                                         <div className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-1 text-left">{f.phase}</div>
                                         <div className="font-bold text-slate-900 text-lg text-left">{f.name}</div>
                                      </td>
                                      <td className="py-6 text-center font-bold text-slate-500">{f.hours}h</td>
                                      <td className="py-6 text-right font-black text-slate-900 text-lg text-right">{currencySymbol}{(f.hours * active.base_rate).toLocaleString()}</td>
                                      <td className="py-6 text-right no-pdf pl-6 text-right">
                                         <button onClick={() => handleDeleteFeature(f.id!)} className="p-2 text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 text-right text-slate-200">
                                            <Trash2 size={16} className="text-slate-200 text-right" />
                                         </button>
                                      </td>
                                   </tr>
                                ))}
                                {features.length === 0 && (
                                   <tr>
                                      <td colSpan={4} className="py-20 text-center">
                                        <div className="text-slate-300 font-bold uppercase tracking-widest text-center">Awaiting Scope Definition</div>
                                      </td>
                                   </tr>
                                )}
                             </tbody>
                          </table>

                          <div className="pt-12 space-y-6 text-left">
                             <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-widest text-left">
                                <span>Baseline Development Investment</span>
                                <span>{currencySymbol}{totals.baseCost.toLocaleString()}</span>
                             </div>
                             
                             <div className="flex justify-between items-center p-6 bg-amber-50 rounded-3xl border border-amber-100 text-left">
                                <div className="flex items-center gap-4 text-left">
                                  <div className="w-10 h-10 bg-amber-200/50 rounded-xl flex items-center justify-center text-amber-700 text-center">
                                    <RefreshCw size={18} className="animate-spin-slow text-amber-700 text-center" />
                                  </div>
                                  <div className="text-left">
                                    <div className="text-amber-900 font-black text-xs uppercase tracking-wider text-left">Volatility Buffer ({active.volatility_buffer}x)</div>
                                    <div className="text-amber-700/70 text-[10px] font-bold mt-0.5 uppercase text-left">Accounts for evolving requirements</div>
                                  </div>
                                </div>
                                <div className="text-lg font-black text-amber-700 text-right">
                                   +{currencySymbol}{Math.round(totals.baseCost * (active.volatility_buffer - 1)).toLocaleString()}
                                </div>
                             </div>

                             {active.include_gst && (
                               <div className="flex justify-between items-center px-6 text-sm font-bold text-slate-400 uppercase tracking-widest text-left">
                                  <span>GST / Regulatory Tax (18%)</span>
                                  <span>{currencySymbol}{Math.round(totals.gst).toLocaleString()}</span>
                               </div>
                             )}

                             <div className="p-10 bg-slate-900 rounded-[40px] shadow-2xl shadow-slate-900/40 flex justify-between items-end text-white text-left">
                                <div className="text-left">
                                   <div className="text-blue-400 font-black uppercase tracking-[0.3em] text-[10px] mb-2 text-left">Total Project Architecture Investment</div>
                                   <div className="text-6xl font-black tracking-tighter text-left">
                                      {currencySymbol}{Math.round(totals.total).toLocaleString()}
                                   </div>
                                </div>
                                <div className="text-right space-y-1 opacity-50 font-bold uppercase tracking-widest text-[10px] text-right">
                                   <div>{totals.bufferedHours.toFixed(1)} Architectural Hours</div>
                                   <div>Valid for 30 days</div>
                                </div>
                             </div>
                          </div>
                        </div>

                        <div className="p-12 border-t border-dashed border-slate-200 text-center">
                           <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] text-center">Digital Strategy • Product Excellence • 2026</div>
                        </div>
                     </div>
                  </div>

                  {/* QUICK CONTROLS SIDE PANEL */}
                  <div className="col-span-4 no-pdf text-left">
                     <div className="sticky top-12 space-y-8 text-left">
                        {/* LIVE SUMMARY WIDGET */}
                        <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-2xl shadow-blue-500/5 space-y-6 text-center">
                           <div className="flex justify-center text-center">
                              <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner text-center">
                                <DollarSign size={24} className="text-blue-600 text-center" />
                              </div>
                           </div>
                           <div className="text-center text-slate-900">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 text-center">Architectural Summary</div>
                              <div className="text-5xl font-black text-slate-900 tracking-tighter text-center">
                                 {currencySymbol}{Math.round(totals.total).toLocaleString()}
                              </div>
                              <div className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest flex items-center justify-center gap-2 text-center">
                                <Layout size={12} className="text-slate-400 text-center" /> {totals.bufferedHours.toFixed(1)} billable hrs
                              </div>
                           </div>
                        </div>

                        {/* PROJECT SETTINGS */}
                        <div className="card p-8 space-y-8 text-left">
                           <div className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase tracking-widest pb-4 border-b border-slate-50 text-left">
                              <Settings size={18} className="text-blue-600 text-left"/> Engineering Controls
                           </div>

                           <div className="space-y-6 text-left">
                              <div className="space-y-4 text-left">
                                 <div className="flex justify-between items-center text-left">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 text-left">
                                      <RefreshCw size={14} className="text-slate-500 text-left" /> Volatility Multiplier
                                    </label>
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-black text-right">{active.volatility_buffer}x</span>
                                 </div>
                                 <input 
                                    type="range" min="1" max="2.5" step="0.1" 
                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    value={active.volatility_buffer}
                                    onChange={(e) => handleUpdateProject({ volatility_buffer: Number(e.target.value) })}
                                 />
                                 <div className="flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest text-left">
                                    <span>Fixed Scope</span>
                                    <span>High Ambiguity</span>
                                 </div>
                              </div>

                              <div className="space-y-4 pt-6 border-t border-slate-50 text-left">
                                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 text-left">
                                   <DollarSign size={14} className="text-slate-500 text-left" /> Valuation Settings
                                 </label>
                                 <div className="flex gap-2 text-left">
                                    <button 
                                      onClick={() => handleUpdateProject({ currency: 'INR' })}
                                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${active.currency === 'INR' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 text-slate-400'}`}
                                    >
                                      INR (₹)
                                    </button>
                                    <button 
                                      onClick={() => handleUpdateProject({ currency: 'USD' })}
                                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${active.currency === 'USD' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 text-slate-400'}`}
                                    >
                                      USD ($)
                                    </button>
                                 </div>
                                 <button 
                                    onClick={() => handleUpdateProject({ include_gst: !active.include_gst })}
                                    className={`w-full py-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${active.include_gst ? 'bg-emerald-50 text-emerald-700 border-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-400 border-slate-100 text-slate-400'}`}
                                  >
                                    {active.include_gst ? <CheckCircle size={14} className="text-emerald-700" /> : <Plus size={14} className="text-slate-400" />} {active.include_gst ? 'GST Enabled' : 'Apply GST (18%)'}
                                 </button>
                              </div>
                           </div>

                           <div className="p-6 bg-blue-50/50 rounded-[30px] border border-blue-100 space-y-3 text-left">
                              <div className="flex items-center gap-2 text-blue-800 font-black text-[10px] uppercase tracking-widest text-left">
                                <Info size={14} className="text-blue-800 text-left" /> Designer Tip
                              </div>
                              <p className="text-[10px] text-blue-700/70 font-bold leading-relaxed text-left">
                                 Segmenting features into **Phases** (UI, API, Dev) provides clients with a clear roadmap and justifies the investment structure.
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
