// src/PhotoGallery.jsx
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { Image as ImageIcon, Plus, X, UserPlus, Search, Loader2 } from 'lucide-react';

export default function PhotoGallery({ swimmerId, roster }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Upload State
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [taggedSwimmers, setTaggedSwimmers] = useState([]);

  // 1. Fetch Photos for this Profile
  useEffect(() => {
    const fetchPhotos = async () => {
      if (!swimmerId) return;
      
      // A. Find all photo IDs where this swimmer is tagged
      const { data: tags } = await supabase
        .from('photo_tags')
        .select('photo_id')
        .eq('swimmer_id', swimmerId);

      if (!tags || tags.length === 0) {
        setPhotos([]);
        setLoading(false);
        return;
      }

      const photoIds = tags.map(t => t.photo_id);

      // B. Fetch the actual photo details
      const { data: photoData } = await supabase
        .from('photos')
        .select('*')
        .in('id', photoIds)
        .order('created_at', { ascending: false });

      setPhotos(photoData || []);
      setLoading(false);
    };

    fetchPhotos();
  }, [swimmerId]);

  // 2. Handle Tagging Logic
  const toggleTag = (swimmer) => {
    if (taggedSwimmers.find(s => s.id === swimmer.id)) {
      setTaggedSwimmers(prev => prev.filter(s => s.id !== swimmer.id));
    } else {
      setTaggedSwimmers(prev => [...prev, swimmer]);
    }
  };

  // 3. Handle Upload & Save
  const handleUpload = async () => {
    if (!selectedFile) return alert("Please select a photo.");

    setUploading(true);
    try {
      // A. Upload Image
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('swimmer-photos')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('swimmer-photos')
        .getPublicUrl(fileName);

      // B. Insert into Photos Table
      const { data: photoRecord, error: dbError } = await supabase
        .from('photos')
        .insert([{ url: publicUrl, caption: caption }])
        .select()
        .single();

      if (dbError) throw dbError;

      // C. Create Tags (Current Profile + Any Tagged Friends)
      // Always tag the swimmer whose profile we are currently on!
      const allIdsToTag = new Set([swimmerId, ...taggedSwimmers.map(s => s.id)]);
      
      const tagInserts = Array.from(allIdsToTag).map(id => ({
        photo_id: photoRecord.id,
        swimmer_id: id
      }));

      await supabase.from('photo_tags').insert(tagInserts);

      // D. Cleanup & Update UI
      setPhotos(prev => [photoRecord, ...prev]);
      setIsModalOpen(false);
      setSelectedFile(null);
      setCaption("");
      setTaggedSwimmers([]);
      setSearchQuery("");
      alert("Photo uploaded and swimmers tagged!");

    } catch (error) {
      console.error(error);
      alert("Error uploading: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const filteredRoster = roster.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
    s.id !== swimmerId // Don't show current swimmer in search (auto-tagged)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ImageIcon className="text-blue-600" size={20} /> Photo Gallery
        </h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Add Photo
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading...</div>
      ) : photos.length === 0 ? (
        <div className="text-center border-2 border-dashed border-slate-200 rounded-2xl py-12 bg-slate-50">
            <ImageIcon size={48} className="mx-auto text-slate-300 mb-2"/>
            <p className="text-slate-500 font-medium">No photos yet</p>
            <p className="text-xs text-slate-400">Upload one to start the gallery!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(photo => (
            <div key={photo.id} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img src={photo.url} alt="Swimmer moment" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                  <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Upload Photo</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* File Input */}
              <div>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Caption</label>
                <input 
                  type="text" 
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Great race at Sectionals!"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Tagging Interface */}
              <div className="border-t pt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <UserPlus size={14}/> Tag Teammates
                </label>
                
                {/* Selected Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {taggedSwimmers.map(s => (
                        <span key={s.id} className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            {s.name} <button onClick={() => toggleTag(s)}><X size={12}/></button>
                        </span>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-2">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search roster..."
                        className="w-full pl-9 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    />
                </div>

                {/* Search Results */}
                <div className="max-h-32 overflow-y-auto border rounded-lg divide-y">
                    {filteredRoster.map(s => (
                        <button 
                            key={s.id} 
                            onClick={() => toggleTag(s)}
                            disabled={taggedSwimmers.some(ts => ts.id === s.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between"
                        >
                            <span>{s.name}</span>
                            {taggedSwimmers.some(ts => ts.id === s.id) && <Check size={14} className="text-emerald-500"/>}
                        </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
              <button 
                onClick={handleUpload} 
                disabled={uploading || !selectedFile}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading && <Loader2 size={16} className="animate-spin"/>}
                {uploading ? 'Uploading...' : 'Save Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
