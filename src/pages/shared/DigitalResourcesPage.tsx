import { useState, useMemo, useEffect } from 'react';
import { Edit2, Trash2, Search, FileText, Download, Upload, Filter, Eye } from 'lucide-react';
import { useStore } from '../../store';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Modal } from '../../components/UI/Modal';
import { Input, Textarea, Select } from '../../components/UI/Input';
import { Badge } from '../../components/UI/Table';
import type { DigitalResource } from '../../types';
import { cn } from '../../utils/cn';
import { format, parseISO } from 'date-fns';
import { fetchDigitalResources, createDigitalResource, updateDigitalResource as updateResourceService, deleteDigitalResource as deleteResourceService } from '../../services';

interface DigitalResourcesPageProps {
  canManage?: boolean;
}

export function DigitalResourcesPage({ canManage = false }: DigitalResourcesPageProps) {
  const { digitalResources, addDigitalResource, updateDigitalResource, deleteDigitalResource, incrementDownload, currentUser, users, setDigitalResources } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<DigitalResource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewingResource, setViewingResource] = useState<DigitalResource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fileUrl: '',
    fileType: 'PDF',
    fileSize: '',
    category: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load digital resources from database
  useEffect(() => {
    const loadResources = async () => {
      setIsLoading(true);
      try {
        const result = await fetchDigitalResources();
        if (result.data) {
          // Update store with real data from database
          setDigitalResources(result.data);
        }
      } catch (error) {
        console.error('Error loading digital resources:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadResources();
  }, [setDigitalResources]);

  const categories = useMemo(() => {
    const cats = new Set(digitalResources.map(r => r.category));
    return ['all', ...Array.from(cats)];
  }, [digitalResources]);

  const filteredResources = useMemo(() => {
    return digitalResources.filter(resource => {
      const matchesSearch = 
        resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [digitalResources, searchQuery, categoryFilter]);

  const handleOpenModal = (resource?: DigitalResource) => {
    if (resource) {
      setEditingResource(resource);
      setFormData({
        title: resource.title,
        description: resource.description,
        fileUrl: resource.fileUrl,
        fileType: resource.fileType,
        fileSize: resource.fileSize,
        category: resource.category,
      });
      setSelectedFile(null);
    } else {
      setEditingResource(null);
      setFormData({ title: '', description: '', fileUrl: '', fileType: 'PDF', fileSize: '', category: '' });
      setSelectedFile(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      if (editingResource) {
        // Update existing resource (only metadata, not file)
        const result = await updateResourceService(editingResource.id, formData);
        if (result.error) {
          setMessage({ type: 'error', text: result.error });
        } else {
          updateDigitalResource(editingResource.id, result.data!);
          setMessage({ type: 'success', text: 'Resource updated successfully!' });
        }
      } else {
        // Create new resource with file upload
        if (!selectedFile) {
          setMessage({ type: 'error', text: 'Please select a file to upload' });
          setIsSaving(false);
          return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!allowedTypes.includes(selectedFile.type)) {
          setMessage({ type: 'error', text: 'Invalid file type. Please upload PDF, Word, PowerPoint, or Excel files.' });
          setIsSaving(false);
          return;
        }

        // Validate file size (max 50MB)
        if (selectedFile.size > 50 * 1024 * 1024) {
          setMessage({ type: 'error', text: 'File size too large. Maximum size is 50MB.' });
          setIsSaving(false);
          return;
        }

        const result = await createDigitalResource({
          ...formData,
          uploadedBy: currentUser?.id || '',
        }, selectedFile);

        if (result.error) {
          setMessage({ type: 'error', text: result.error });
        } else {
          addDigitalResource(result.data!);
          setMessage({ type: 'success', text: 'Resource uploaded successfully!' });
        }
      }

      if (!message?.type || message.type === 'success') {
        setIsModalOpen(false);
        setEditingResource(null);
        setSelectedFile(null);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
      console.error('Error saving resource:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this resource?')) {
      try {
        const result = await deleteResourceService(id);
        if (result.error) {
          setMessage({ type: 'error', text: result.error });
        } else {
          deleteDigitalResource(id);
          setMessage({ type: 'success', text: 'Resource deleted successfully!' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to delete resource' });
        console.error('Error deleting resource:', error);
      }
    }
  };

  const handleDownload = async (resource: DigitalResource) => {
    try {
      // Increment download count
      await incrementDownload(resource.id);

      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = resource.fileUrl;
      link.download = `${resource.title}.${resource.fileType.toLowerCase()}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update local state
      incrementDownload(resource.id);
    } catch (error) {
      console.error('Error downloading file:', error);
      setMessage({ type: 'error', text: 'Failed to download file' });
    }
  };

  const fileTypeColors: Record<string, string> = {
    'PDF': 'from-red-500 to-rose-600',
    'DOC': 'from-blue-500 to-indigo-600',
    'PPT': 'from-orange-500 to-amber-600',
    'XLS': 'from-emerald-500 to-teal-600',
  };

  const totalDownloads = digitalResources.reduce((acc, r) => acc + r.downloads, 0);

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <Card className={cn(
          'p-4 rounded-lg',
          message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        )}>
          {message.text}
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Digital Resources</h2>
          <p className="text-gray-500 dark:text-gray-400">
            {filteredResources.length} resources • {totalDownloads} total downloads
          </p>
        </div>
        {canManage && (
          <Button onClick={() => handleOpenModal()} icon={<Upload size={18} />}>
            Upload Resource
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{digitalResources.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Resources</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-indigo-600">{totalDownloads}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Downloads</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-emerald-600">{categories.length - 1}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Categories</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-amber-600">
            {digitalResources.filter(r => r.fileType === 'PDF').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">PDF Documents</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Resources Grid */}
      {filteredResources.length === 0 ? (
        <Card className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No resources found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map(resource => {
            const uploader = users.find(u => u.id === resource.uploadedBy);
            return (
              <Card key={resource.id} hover className="flex flex-col">
                <div className={cn(
                  'h-24 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br',
                  fileTypeColors[resource.fileType] || 'from-gray-500 to-gray-600'
                )}>
                  <FileText size={40} className="text-white/80" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{resource.title}</h3>
                    <Badge variant="info">{resource.fileType}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                    {resource.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                    <span>{resource.category}</span>
                    <span>•</span>
                    <span>{resource.fileSize}</span>
                    <span>•</span>
                    <span>{resource.downloads} downloads</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Uploaded by {uploader?.name || 'Unknown'} on {format(parseISO(resource.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => setViewingResource(resource)}
                    icon={<Eye size={14} />}
                  >
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleDownload(resource)}
                    icon={<Download size={14} />}
                  >
                    Download
                  </Button>
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleOpenModal(resource)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(resource.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={!!viewingResource}
        onClose={() => setViewingResource(null)}
        title={viewingResource?.title || 'Resource Preview'}
        size="xl"
      >
        {viewingResource && (
          <div className="space-y-4">
            {/* PDF Preview */}
            {viewingResource.fileType === 'PDF' && (
              <div className="h-96 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <iframe
                  src={viewingResource.fileUrl}
                  className="w-full h-full"
                  title={`Preview of ${viewingResource.title}`}
                />
              </div>
            )}

            {/* Other file types - show icon */}
            {viewingResource.fileType !== 'PDF' && (
              <div className={cn(
                'h-48 rounded-xl flex items-center justify-center bg-gradient-to-br',
                fileTypeColors[viewingResource.fileType] || 'from-gray-500 to-gray-600'
              )}>
                <FileText size={64} className="text-white/80" />
              </div>
            )}

            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {viewingResource.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{viewingResource.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium text-gray-900 dark:text-white">{viewingResource.category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">File Type</p>
                <p className="font-medium text-gray-900 dark:text-white">{viewingResource.fileType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">File Size</p>
                <p className="font-medium text-gray-900 dark:text-white">{viewingResource.fileSize}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Downloads</p>
                <p className="font-medium text-gray-900 dark:text-white">{viewingResource.downloads}</p>
              </div>
            </div>
            <Button fullWidth onClick={() => handleDownload(viewingResource)} icon={<Download size={18} />}>
              Download Resource
            </Button>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingResource ? 'Edit Resource' : 'Upload New Resource'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter resource title"
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter resource description"
            rows={3}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Machine Learning"
              required
            />
            <Select
              label="File Type"
              value={formData.fileType}
              onChange={(e) => setFormData({ ...formData, fileType: e.target.value })}
              options={[
                { value: 'PDF', label: 'PDF Document' },
                { value: 'DOC', label: 'Word Document' },
                { value: 'PPT', label: 'PowerPoint' },
                { value: 'XLS', label: 'Excel Spreadsheet' },
              ]}
            />
          </div>

          {!editingResource && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Upload
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    // Auto-detect file type
                    let fileType = 'PDF';
                    if (file.type.includes('pdf')) fileType = 'PDF';
                    else if (file.type.includes('word') || file.name.endsWith('.docx')) fileType = 'DOC';
                    else if (file.type.includes('presentation') || file.name.endsWith('.pptx')) fileType = 'PPT';
                    else if (file.type.includes('sheet') || file.name.endsWith('.xlsx')) fileType = 'XLS';

                    setFormData({ ...formData, fileType });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={!editingResource}
              />
              {selectedFile && (
                <p className="text-sm text-gray-500 mt-1">
                  Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}

          {editingResource && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="File URL"
                value={formData.fileUrl}
                onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                placeholder="File URL (read-only for existing resources)"
                readOnly
              />
              <Input
                label="File Size"
                value={formData.fileSize}
                onChange={(e) => setFormData({ ...formData, fileSize: e.target.value })}
                placeholder="File size (read-only for existing resources)"
                readOnly
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} fullWidth disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={isSaving}>
              {isSaving ? 'Uploading...' : (editingResource ? 'Update Resource' : 'Upload Resource')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
