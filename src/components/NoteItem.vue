<template>
  <div ref="noteRef">
    <!-- Placeholder for Create Mode -->
    <div v-if="isPlaceholder">
      <div class="note-placeholder" @click="switchToEditMode">
        Enter text...
      </div>
    </div>

    <!-- Edit/Create Mode -->
    <div v-else-if="isEditing">
      <div class="note-content">
        <!-- Reply Block (Hide in Reply Edit Mode) -->
        <div v-if="showReplyBlock" class="note-reply">
          <span class="note-reply-link" @click="handleReplyClick(reply)">
            {{ reply.textPreview }}
          </span>
          <n-icon
            size="20"
            class="note-reply-remove-icon"
            @click="handleRemoveReply"
          >
            <CloseIcon />
          </n-icon>
        </div>

        <!-- Note Text Input -->
        <n-input
          :value="text"
          type="textarea"
          placeholder="Enter text..."
          autosize
          :maxlength="CHARACTER_LIMIT"
          class="note-text-input"
          @update:value="updateText"
          @input="emitInput"
        />

        <!-- Character Count -->
        <div v-if="showCharacterCount" class="character-count">
          {{ text.length }} / {{ CHARACTER_LIMIT }}
        </div>

        <!-- Tags Input -->
        <TagInput v-model="tags" />

        <!-- Save and Cancel Buttons -->
        <div class="note-footer">
          <div class="note-footer-buttons">
            <n-button @click="handleCancelClick">Cancel</n-button>
            <n-button
              type="primary"
              :disabled="text.length > CHARACTER_LIMIT"
              @click="handleSave"
            >
              {{ mode === 'edit' ? 'Update' : 'Create' }}
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <!-- View Mode -->
    <div v-else>
      <div :class="['note-content', { blurred: isDeleted }]">
        <div v-if="note.parentId" class="note-reply">
          <span class="note-reply-link" @click="handleReplyClick(note)">
            {{ note.parentTextPreview }}
          </span>
        </div>
        <div class="note-text">
          {{ note.text }}
        </div>
        <div v-if="note.tags" class="note-tags">
          <n-button
            v-for="tag in note.tags"
            :key="tag"
            size="small"
            round
            class="custom-tag"
          >
            {{ tag }}
          </n-button>
        </div>
        <div class="note-footer">
          <div class="note-time clickable-link" @click="handleTimeClick(note)">
            {{ displayedTime }}
            <span v-if="note.createdAt !== note.modifiedAt" class="note-edited">
              (edited)
            </span>
          </div>
          <div class="note-stats">
            <n-button
              v-if="note.replyCount > 0"
              text
              class="inline-flex items-center faded-text"
              @click="handleChatClick(note)"
            >
              <n-icon class="icon-margin faded-text">
                <ReplyIcon />
              </n-icon>
              <span class="faded-text">
                {{ note.replyCount }}
              </span>
            </n-button>
            <n-dropdown
              trigger="click"
              placement="bottom-end"
              :options="dropdownOptions"
              @select="handleDropdownCommand"
            >
              <n-button text class="inline-flex items-center faded-text">
                <n-icon><MoreIcon /></n-icon>
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </div>

      <div v-if="isDeleted" class="note-overlay">
        <div class="note-overlay-content">
          <div class="note-deleted-text">Note was deleted</div>
          <n-button
            size="small"
            class="note-deleted-cancel"
            @click="handleRestoreClick"
            >Restore</n-button
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  NButton,
  NIcon,
  NDropdown,
  NInput,
} from 'naive-ui'
import {
  ArrowUndoOutline as ReplyIcon,
  EllipsisVerticalOutline as MoreIcon,
  Close as CloseIcon
} from '@vicons/ionicons5'
import TagInput from './TagInput.vue'

export default {
  name: 'NoteItem',
  components: {
    NButton,
    NIcon,
    NDropdown,
    NInput,
    ReplyIcon,
    MoreIcon,
    CloseIcon,
    TagInput
  },
  props: {
    mode: {
      type: String,
      default: 'view'
    },
    note: {
      type: Object,
      default: () => ({})
    },
    parentNote: {
      type: Object,
      default: null
    },
    index: {
      type: Number,
      default: null
    },
    hideReplyBlock: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'reply-click',
    'chat-click',
    'time-click',
    'dropdown-command',
    'create-note',
    'update-note',
    'cancel-create',
    'unsaved-changes',
    'restore-note'
  ],
  data() {
    return {
      text: this.note?.text || '',
      tags: this.note?.tags ? [...this.note.tags] : [],
      reply: this.parentNote
        ? {
            id: this.parentNote.id,
            textPreview: this.parentNote.text
          }
        : this.note?.parentId
          ? {
              id: this.note.parentId,
              textPreview: this.note.parentTextPreview
            }
          : null,
      editingState:
        this.mode === 'edit' || (this.mode === 'create' && this.parentNote),
      isPlaceholder: this.mode === 'create' && !this.parentNote,
      CHARACTER_LIMIT: 1000,
      dropdownOptions: [
        { label: 'Reply', key: 'reply' },
        { label: 'Edit', key: 'edit' },
        { label: 'Delete', key: 'delete' }
      ],
      initialText: this.note?.text || '',
      initialTags: this.note?.tags ? [...this.note.tags] : []
    }
  },
  computed: {
    isEditing() {
      return this.editingState
    },
    showCharacterCount() {
      return this.text.length >= this.CHARACTER_LIMIT * 0.8
    },
    hasUnsavedChanges() {
      return (
        this.text !== this.initialText ||
        JSON.stringify(this.tags) !== JSON.stringify(this.initialTags)
      )
    },
    isReplyNote() {
      return !!this.parentNote
    },
    showReplyBlock() {
      return this.reply && !this.isReplyNote && !this.hideReplyBlock
    },
    isDeleted() {
      return this.note && this.note.deletedAt
    }
  },
  setup(props) {
    // Intersection Observer reference
    const noteRef = ref(null)
    const isNoteVisible = ref(false)
    let intersectionObserver = null

    // We'll store the interval info in a reactive object
    // so we can attach metadata safely.
    const refreshInterval = ref({
      id: null,
      updateSec: 0
    })

    const displayedTime = ref('')

    // Determine how frequently to refresh
    function getUpdateIntervalSeconds(createdAt) {
      if (!createdAt) return 0

      const now = new Date()
      const created = new Date(createdAt)
      let diff = now - created
      if (diff < 0) diff = 0
      const diffSeconds = Math.floor(diff / 1000)

      if (diffSeconds < 60) {
        return 6
      } 
      else if (diffSeconds < 360) {
        return 60
      } 
      else if (diffSeconds < 86400) {
        return 3600
      } 
      else {
        return 0
      }
    }

    // Format time
    function formatTime(createdAt) {
      if (!createdAt) return ''
      const now = new Date()
      const created = new Date(createdAt)
      let diff = now - created
      if (diff < 0) diff = 0
      const diffSeconds = Math.floor(diff / 1000)
      const minutes = Math.floor(diffSeconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      const years = now.getFullYear() - created.getFullYear()

      if (diffSeconds <= 3) {
        return 'just now'
      } else if (diffSeconds < 60) {
        return `${diffSeconds} seconds ago`
      } else if (minutes < 60) {
        return `${minutes} minutes ago`
      } else if (hours < 24) {
        return `${hours} hours ago`
      } else if (days < 30) {
        return `${days} days ago`
      } else if (years < 1) {
        return created.toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric'
        })
      } else {
        return created.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric'
        })
      }
    }

    function refreshDisplayedTime() {
      displayedTime.value = formatTime(props.note.createdAt)
      // Decide if we need to keep auto-updating
      const intervalSeconds = getUpdateIntervalSeconds(props.note.createdAt)
      // If note not visible or no auto-updates needed, clear interval
      if (!isNoteVisible.value || intervalSeconds === 0) {
        clearAutoRefresh()
        return
      }

      // If we already have the correct interval set, do nothing
      if (refreshInterval.value.id && refreshInterval.value.updateSec === intervalSeconds) {
        return
      }

      // Otherwise, set a new interval
      clearAutoRefresh() // Clear any existing interval
      const ms = intervalSeconds * 1000
      const newId = setInterval(() => {
        displayedTime.value = formatTime(props.note.createdAt)
        // If crossing a threshold, reevaluate
        refreshDisplayedTime()
      }, ms)

      refreshInterval.value = {
        id: newId,
        updateSec: intervalSeconds
      }
    }

    function clearAutoRefresh() {
      if (refreshInterval.value.id) {
        clearInterval(refreshInterval.value.id)
        refreshInterval.value.id = null
        refreshInterval.value.updateSec = 0
      }
    }

    onMounted(() => {
      displayedTime.value = formatTime(props.note.createdAt)

      intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.target === noteRef.value) {
            isNoteVisible.value = entry.isIntersecting
            refreshDisplayedTime()
          }
        })
      })

      if (noteRef.value) {
        intersectionObserver.observe(noteRef.value)
      }
    })

    onUnmounted(() => {
      if (intersectionObserver && noteRef.value) {
        intersectionObserver.unobserve(noteRef.value)
      }
      clearAutoRefresh()
    })

    return {
      noteRef,
      displayedTime,
      isNoteVisible
    }
  },
  methods: {
    // --- The rest of your methods (handleReplyClick, handleSave, etc.) ---
    // They remain the same as before, no changes needed there.
    switchToEditMode() {
      this.editingState = true
      this.isPlaceholder = false
      this.initialText = this.text
      this.initialTags = [...this.tags]
    },
    switchToViewMode() {
      this.editingState = false
    },
    handleReplyClick(note) {
      this.$emit('reply-click', note)
    },
    handleChatClick(note) {
      this.$emit('chat-click', note)
    },
    handleTimeClick(note) {
      this.$emit('time-click', note)
    },
    handleDropdownCommand(key) {
      if (key === 'edit') {
        this.switchToEditMode()
      } else {
        this.$emit('dropdown-command', key, this.note)
      }
    },
    handleSave() {
      const noteData = {
        text: this.text,
        tags: this.tags,
        parentId: this.reply ? this.reply.id : null
      }
      this.$emit('unsaved-changes', false)
      if (this.mode === 'edit' || this.note.id) {
        this.$emit('update-note', noteData, this.note, this.index)
        this.switchToViewMode()
      } else {
        this.$emit('create-note', noteData, this.index)
        this.text = ''
        this.tags = []
        this.reply = null
        if (!this.parentNote) {
          this.editingState = false
          this.isPlaceholder = true
        }
      }
    },
    handleCancelClick() {
      if (this.hasUnsavedChanges) {
        this.$refs.warningDialog?.destroy()
        this.$dialog?.warning({
          title: 'Unsaved Changes',
          content: 'Changes you made may not be saved. Do you want to continue?',
          positiveText: 'Yes',
          negativeText: 'No',
          onPositiveClick: () => {
            this.discardChanges()
          }
        })
      } else {
        this.discardChanges()
      }
    },
    discardChanges() {
      if (this.mode === 'create' && this.parentNote) {
        this.$emit('cancel-create', this.index)
      } else if (this.mode === 'create') {
        this.text = ''
        this.tags = []
        this.reply = null
        this.editingState = false
        this.isPlaceholder = true
      } else {
        this.text = this.initialText
        this.tags = [...this.initialTags]
        this.switchToViewMode()
      }
    },
    handleRemoveReply() {
      this.$dialog?.warning({
        title: 'Confirm Removal',
        content: 'Are you sure you want to remove the reply?',
        positiveText: 'Yes',
        negativeText: 'No',
        onPositiveClick: () => {
          this.reply = null
        }
      })
    },
    handleRestoreClick() {
      this.$emit('restore-note', this.note, this.index)
    },
    emitInput() {
      // For unsaved changes tracking if needed
    },
    updateText(value) {
      this.text = value
    }
  }
}
</script>

<style scoped>
.note-content {
  position: relative; /* so the note overlay can position absolutely */
}

.blurred {
  filter: blur(2px);
}

.note-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(var(--block-color-rgb), 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  border-radius: inherit;
  z-index: 1;
}

.note-overlay-content {
  text-align: center;
}

.note-deleted-text {
  font-size: 20px;
  color: var(--text-color);
  font-weight: normal;
}

.note-deleted-cancel {
  margin-top: 8px;
}

.note-reply {
  background-color: var(--overlay-bg-color);
  border-radius: 10px;
  padding: 8px;
  font-size: 14px;
  color: var(--faded-text-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.note-reply-link {
  color: inherit;
  cursor: pointer;
  flex: 1;
}

.note-reply-remove-icon {
  cursor: pointer;
  color: var(--faded-text-color);
  margin-left: 8px;
}

.note-text {
  font-size: 20px;
  color: var(--text-color);
  word-break: break-word;
}

.note-tags {
  font-size: 16px;
  color: var(--text-color);
  margin-bottom: 5px;
}

.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.note-footer-buttons {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.note-stats {
  display: flex;
  align-items: center;
}

.note-time {
  color: var(--faded-text-color);
}

.clickable-link {
  cursor: pointer;
}

.custom-tag {
  background-color: var(--tag-bg-color);
  color: var(--faded-text-color);
  border: none;
}

.custom-tag:hover {
  color: var(--text-color);
}

.faded-text {
  color: var(--faded-text-color);
}

.note-text-input {
  width: 100%;
  margin-top: 10px;
  font-size: 20px;
  border-radius: 10px;
}

.character-count {
  text-align: right;
  margin-top: 5px;
  font-size: 14px;
  color: var(--faded-text-color);
}

.note-placeholder {
  font-size: 20px;
  color: var(--faded-text-color);
  cursor: pointer;
}
</style>
