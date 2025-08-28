<template>
  <div class="notebook-container">
    <div class="sidebar">
      <t-card class="sidebar-header">
        <t-input
          v-model="searchQuery"
          placeholder="搜索笔记..."
          :prefix-icon="SearchIcon"
          class="search-input"
        />
        <t-button type="primary" @click="createNewNote" class="new-note-btn">
          <PlusIcon size="16" class="mr-2" />
          新建笔记
        </t-button>
      </t-card>

      <t-card class="notes-list-card">
        <div class="notes-list-header">
          <h3 class="notes-title">我的笔记</h3>
          <t-select v-model="sortOption" @change="sortNotes">
            <t-option value="updatedAt" label="最近更新"></t-option>
            <t-option value="createdAt" label="创建时间"></t-option>
            <t-option value="title" label="标题"></t-option>
          </t-select>
        </div>

        <div class="notes-list">
          <div
            v-for="note in filteredNotes"
            :key="note.id"
            class="note-item"
            :class="{ 'active': selectedNoteId === note.id }"
            @click="selectNote(note.id)"
          >
            <div class="note-item-content">
              <h4 class="note-title">{{ note.title }}</h4>
              <p class="note-preview">{{ getNotePreview(note.content) }}</p>
              <div class="note-meta">
                <span class="note-date">{{ formatDate(note.updatedAt) }}</span>
                <div class="note-tags" v-if="note.tags && note.tags.length > 0">
                  <t-tag
                    v-for="tag in note.tags.slice(0, 2)"
                    :key="tag"
                    variant="outline"
                    size="small"
                  >
                    {{ tag }}
                  </t-tag>
                  <t-tag v-if="note.tags.length > 2" variant="outline" size="small">
                    +{{ note.tags.length - 2 }}
                  </t-tag>
                </div>
              </div>
            </div>
            <div class="note-actions">
              <t-button
                size="icon"
                variant="text"
                @click.stop="deleteNote(note.id)"
                class="delete-btn"
              >
                <DeleteIcon size="16" />
              </t-button>
            </div>
          </div>

          <div class="empty-state" v-if="filteredNotes.length === 0 && !loading">
            <NoteIcon size="48" class="empty-icon" />
            <p class="empty-text">暂无笔记</p>
            <p class="empty-subtext">点击"新建笔记"开始记录</p>
          </div>

          <div class="loading-state" v-if="loading">
            <t-loading size="small" />
            <p class="loading-text">加载中...</p>
          </div>
        </div>
      </t-card>
    </div>

    <div class="main-content">
      <div class="editor-container" v-if="selectedNote || isCreatingNewNote">
        <t-card class="editor-card">
          <t-input
            v-model="currentNote.title"
            placeholder="请输入标题..."
            class="note-title-input"
            :disabled="isSaving"
          />

          <t-textarea
            v-model="currentNote.content"
            placeholder="请输入笔记内容..."
            class="note-content-editor"
            :disabled="isSaving"
          />

          <div class="note-tags-editor">
            <t-tag-input
              v-model="currentNote.tags"
              placeholder="添加标签..."
              :disabled="isSaving"
            />
          </div>

          <div class="editor-actions">
            <div class="note-status" v-if="currentNote.id">
              <span>最后更新: {{ formatDate(currentNote.updatedAt) }}</span>
            </div>
            <div class="action-buttons">
              <t-button
                variant="outline"
                @click="cancelEdit"
                :disabled="isSaving"
              >
                取消
              </t-button>
              <t-button
                type="primary"
                @click="saveCurrentNote"
                :disabled="isSaving || !canSaveNote"
                :loading="isSaving"
              >
                {{ isSaving ? '保存中...' : '保存笔记' }}
              </t-button>
            </div>
          </div>
        </t-card>
      </div>

      <div class="welcome-state" v-else>
        <NoteIcon size="64" class="welcome-icon" />
        <h2 class="welcome-title">小本本</h2>
        <p class="welcome-text">选择一个笔记进行编辑，或创建新笔记开始记录</p>
        <t-button type="primary" @click="createNewNote" class="welcome-btn">
          <PlusIcon size="16" class="mr-2" />
          新建笔记
        </t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ipcRenderer } from 'electron';
import { TCard, TInput, TButton, TTextarea, TSelect, TOption, TTag, TTagInput, TLoading } from 'tdesign-vue-next';
import { SearchIcon, PlusIcon, DeleteIcon, NoteIcon } from '@tdesign/icons-vue-next';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// 状态管理
const notes = ref<Note[]>([]);
const selectedNoteId = ref<string>('');
const currentNote = ref<Partial<Note>>({});
const searchQuery = ref('');
const sortOption = ref('updatedAt');
const isCreatingNewNote = ref(false);
const isSaving = ref(false);
const loading = ref(false);

// 计算属性
const filteredNotes = computed(() => {
  let result = [...notes.value];

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }

  // 排序
  result.sort((a, b) => {
    if (sortOption.value === 'updatedAt') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    } else if (sortOption.value === 'createdAt') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortOption.value === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  return result;
});

const canSaveNote = computed(() => {
  return (
    currentNote.value.title &&
    currentNote.value.title.trim().length > 0 &&
    currentNote.value.content !== undefined
  );
});

const selectedNote = computed(() => {
  if (!selectedNoteId.value) return null;
  return notes.value.find(note => note.id === selectedNoteId.value) || null;
});

// 生命周期钩子
onMounted(() => {
  fetchNotes();
});

// 监听选中笔记变化
watch(selectedNote, (newNote) => {
  if (newNote) {
    currentNote.value = { ...newNote };
    isCreatingNewNote.value = false;
  }
});

// 方法
const fetchNotes = async () => {
  try {
    loading.value = true;
    const result = await ipcRenderer.invoke('notebook:getNotes');
    if (result.success) {
      notes.value = result.data;
      // 如果有笔记且未选择笔记，默认选择第一条
      if (notes.value.length > 0 && !selectedNoteId.value) {
        selectNote(notes.value[0].id);
      }
    }
  } catch (error) {
    console.error('获取笔记失败:', error);
    alert('获取笔记失败，请重试');
  } finally {
    loading.value = false;
  }
};

const selectNote = (noteId: string) => {
  selectedNoteId.value = noteId;
};

const createNewNote = () => {
  currentNote.value = {
    title: '',
    content: '',
    tags: []
  };
  selectedNoteId.value = '';
  isCreatingNewNote.value = true;
};

const saveCurrentNote = async () => {
  if (!canSaveNote.value) return;

  try {
    isSaving.value = true;
    const noteToSave = {
      ...currentNote.value,
      title: currentNote.value.title?.trim()
    };

    const result = await ipcRenderer.invoke('notebook:saveNote', noteToSave);
    if (result.success) {
      // 更新本地笔记列表
      const savedNote = result.data;
      const existingIndex = notes.value.findIndex(n => n.id === savedNote.id);

      if (existingIndex >= 0) {
        notes.value.splice(existingIndex, 1, savedNote);
      } else {
        notes.value.unshift(savedNote);
      }

      // 选中新保存的笔记
      selectNote(savedNote.id);

      // 显示成功提示
      alert('笔记保存成功');
    } else {
      alert('保存失败: ' + result.error);
    }
  } catch (error) {
    console.error('保存笔记失败:', error);
    alert('保存笔记时发生错误');
  } finally {
    isSaving.value = false;
  }
};

const deleteNote = async (noteId: string) => {
  if (!confirm('确定要删除这条笔记吗？此操作不可撤销。')) {
    return;
  }

  try {
    const result = await ipcRenderer.invoke('notebook:deleteNote', noteId);
    if (result.success) {
      // 从本地列表中移除
      notes.value = notes.value.filter(note => note.id !== noteId);

      // 如果删除的是当前选中的笔记
      if (selectedNoteId.value === noteId) {
        selectedNoteId.value = '';
        currentNote.value = {};

        // 如果还有其他笔记，选中第一条
        if (notes.value.length > 0) {
          selectNote(notes.value[0].id);
        }
      }
    } else {
      alert('删除失败: ' + result.error);
    }
  } catch (error) {
    console.error('删除笔记失败:', error);
    alert('删除笔记时发生错误');
  }
};

const cancelEdit = () => {
  if (isCreatingNewNote.value) {
    currentNote.value = {};
    isCreatingNewNote.value = false;
  } else if (selectedNote.value) {
    currentNote.value = { ...selectedNote.value };
  }
};

const sortNotes = () => {
  // 由computed属性filteredNotes处理排序
};

// 辅助方法
const getNotePreview = (content: string) => {
  if (!content) return '';
  // 移除HTML标签（如果有）
  const plainText = content.replace(/<[^>]*>?/gm, '');
  // 返回前100个字符作为预览
  return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style scoped>
.notebook-container {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.sidebar {
  width: 320px;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.search-input {
  margin-bottom: 16px;
}

.new-note-btn {
  width: 100%;
}

.notes-list-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
  border: none;
}

.notes-list-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.notes-title {
  margin: 0;
  font-size: 16px;
}

.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.note-item {
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.note-item:hover {
  background-color: #f5f5f5;
}

.note-item.active {
  background-color: #f0f7ff;
  border-left: 3px solid #2d8cf0;
}

.note-item-content {
  flex: 1;
  overflow: hidden;
}

.note-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-preview {
  margin: 0;
  font-size: 12px;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
}

.note-date {
  color: #999;
  white-space: nowrap;
}

.note-tags {
  display: flex;
}

.note-actions {
  display: flex;
  align-items: flex-start;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.note-item:hover .delete-btn {
  opacity: 1;
}

.empty-state,
.welcome-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  text-align: center;
  padding: 24px;
}

.empty-icon,
.welcome-icon {
  color: #ccc;
  margin-bottom: 16px;
}

.empty-text,
.welcome-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 500;
}

.empty-subtext,
.welcome-text {
  margin: 0;
  color: #999;
  max-width: 300px;
}

.welcome-btn {
  margin-top: 24px;
}

.loading-state {
  color: #666;
}

.loading-text {
  margin-top: 16px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.editor-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.note-title-input {
  font-size: 20px;
  font-weight: 500;
  border: none;
  padding: 16px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.note-title-input:focus {
  box-shadow: none;
  border-color: #2d8cf0;
}

.note-content-editor {
  flex: 1;
  min-height: 300px;
  border: none;
  resize: none;
  font-size: 14px;
  line-height: 1.6;
}

.note-content-editor:focus {
  box-shadow: none;
  border-color: #eee;
}

.note-tags-editor {
  padding: 16px 0;
  border-top: 1px solid #eee;
  margin-top: 8px;
}

.editor-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-top: 1px solid #eee;
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 8px;
}
</style>