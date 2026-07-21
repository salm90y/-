/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import FileExplorer from './components/FileExplorer';
import UploadModal from './components/UploadModal';
import DocumentEditor from './components/DocumentEditor';
import { Document } from './types';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const handleDocSave = async (id: number, data: Partial<Document>) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        // Update local state if needed or refresh
        setSelectedDoc(null);
        setActiveTab('explorer');
      }
    } catch (err) {
      console.error('Failed to save document:', err);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'explorer':
        return <FileExplorer onView={(doc) => setSelectedDoc(doc)} />;
      case 'search':
        return <FileExplorer onView={(doc) => setSelectedDoc(doc)} />; // Reusing explorer with search active
      case 'upload':
        // The sidebar button opens the modal, so we just return dashboard here or a landing
        return <Dashboard />;
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            هذه الصفحة تحت التطوير حالياً
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Fixed Right */}
      <Sidebar 
        activeTab={activeTab === 'upload' ? 'dashboard' : activeTab} 
        setActiveTab={(tab) => {
          if (tab === 'upload') {
            setShowUpload(true);
          } else {
            setActiveTab(tab);
          }
        }} 
      />

      {/* Main Content - Padded Right for Sidebar */}
      <main className="flex-1 mr-64">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showUpload && (
          <UploadModal 
            onClose={() => setShowUpload(false)} 
            onSuccess={() => {
              setActiveTab('explorer');
              setShowUpload(false);
            }} 
          />
        )}
        
        {selectedDoc && (
          <DocumentEditor 
            document={selectedDoc} 
            onClose={() => setSelectedDoc(null)} 
            onSave={handleDocSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
