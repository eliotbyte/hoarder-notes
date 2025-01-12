<template>
  <div ref="noteRef">
    <div v-if="isPlaceholder">
      <div class="note-placeholder" @click="switchToEditMode">
        {{ placeholderText }}
      </div>
    </div>

    <div v-else-if="isEditing">
      <div class="note-content">
        <div v-if="showReplyBlock" class="note-reply">
          <span class="note-reply-link" @click="handleReplyClick(reply)">
            {{ reply.textPreview }}
          </span>
          <n-icon size="20" class="note-reply-remove-icon" @click="handleRemoveReply">
            <CloseIcon />
          </n-icon>
        </div>

        <n-input
          :value="text"
          type="textarea"
          :placeholder="placeholderText"
          autosize
          :maxlength="CHARACTER_LIMIT"
          class="note-text-input"
          @update:value="updateText"
          @input="emitInput"
        />

        <div v-if="showCharacterCount" class="character-count">
          {{ text.length }} / {{ CHARACTER_LIMIT }}
        </div>

        <TagInput v-model="tags" />

        <div class="note-footer">
          <div class="note-footer-buttons">
            <n-button @click="handleCancelClick">Cancel</n-button>
            <n-button type="primary" :disabled="text.length > CHARACTER_LIMIT" @click="handleSave">
              {{ mode === 'edit' ? 'Update' : (isReplyNote ? 'Reply' : 'Create') }}
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <div :class="['note-content', { blurred: isDeleted }]">
        <div v-if="note.parentId" class="note-reply">
          <span class="note-reply-link" @click="handleReplyClick(note)">
            {{ note.parentTextPreview }}
          </span>
        </div>
        <div class="note-text">{{ note.text }}</div>
        <div v-if="note.tags" class="note-tags">
          <n-button v-for="tag in note.tags" :key="tag" size="small" round class="custom-tag">
            {{ tag }}
          </n-button>
        </div>
        <div class="note-footer">
          <div class="note-time clickable-link" @click="handleTimeClick(note)">
            {{ displayedTime }}
            <span v-if="note.createdAt !== note.modifiedAt" class="note-edited">(edited)</span>
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
              <span class="faded-text">{{ note.replyCount }}</span>
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
          <n-button size="small" class="note-deleted-cancel" @click="handleRestoreClick">
            Restore
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { NButton, NIcon, NDropdown, NInput } from 'naive-ui'
import {
  ArrowUndoOutline as ReplyIcon,
  EllipsisVerticalOutline as MoreIcon,
  Close as CloseIcon
} from '@vicons/ionicons5'
import TagInput from './TagInput.vue'

function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function isYesterday(currentDate, noteDate) {
  const yesterday = new Date(currentDate)
  yesterday.setDate(currentDate.getDate() - 1)
  return isSameDay(yesterday, noteDate)
}

function isSameYear(date1, date2) {
  return date1.getFullYear() === date2.getFullYear()
}

function differenceInSeconds(date1, date2) {
  return Math.floor((date1 - date2) / 1000)
}

function differenceInMinutes(date1, date2) {
  return Math.floor((date1 - date2) / (1000 * 60))
}

function formatTime(noteDateString) {
  if (!noteDateString) return ''
  const noteDate = new Date(noteDateString)
  const currentDate = new Date()

  const secDiff = differenceInSeconds(currentDate, noteDate)
  const minDiff = differenceInMinutes(currentDate, noteDate)

  if (secDiff < 3) {
    return 'Just now'
  }
  if (secDiff < 60) {
    return `${secDiff} seconds ago`
  }
  if (minDiff < 60) {
    return `${minDiff} minutes ago`
  }
  if (isSameDay(currentDate, noteDate)) {
    const hh = String(noteDate.getHours()).padStart(2, '0')
    const mm = String(noteDate.getMinutes()).padStart(2, '0')
    return `Today, ${hh}:${mm}`
  }
  if (isYesterday(currentDate, noteDate)) {
    const hh = String(noteDate.getHours()).padStart(2, '0')
    const mm = String(noteDate.getMinutes()).padStart(2, '0')
    return `Yesterday, ${hh}:${mm}`
  }
  if (isSameYear(currentDate, noteDate)) {
    const month = String(noteDate.getMonth() + 1).padStart(2, '0')
    const day = String(noteDate.getDate()).padStart(2, '0')
    const hh = String(noteDate.getHours()).padStart(2, '0')
    const mm = String(noteDate.getMinutes()).padStart(2, '0')
    return `${month}/${day}, ${hh}:${mm}`
  }

  const year = noteDate.getFullYear()
  const month = String(noteDate.getMonth() + 1).padStart(2, '0')
  const day = String(noteDate.getDate()).padStart(2, '0')
  const hh = String(noteDate.getHours()).padStart(2, '0')
  const mm = String(noteDate.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day}, ${hh}:${mm}`
}

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
    mode: { type: String, default: 'view' },
    note: { type: Object, default: () => ({}) },
    parentNote: { type: Object, default: null },
    index: { type: Number, default: null },
    hideReplyBlock: { type: Boolean, default: false },
    placeholderText: {
      type: String,
      default: 'Enter text...'
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
        ? { id: this.parentNote.id, textPreview: this.parentNote.text }
        : this.note?.parentId
        ? { id: this.note.parentId, textPreview: this.note.parentTextPreview }
        : null,
      // We remove automatic edit mode for replies:
      editingState: this.mode === 'edit',
      // For create mode, show placeholder first
      isPlaceholder: this.mode === 'create',
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
      // We keep the old check, but remove forced editing
      return this.reply && !this.isReplyNote && !this.hideReplyBlock
    },
    isDeleted() {
      return this.note && this.note.deletedAt
    }
  },
  setup(props) {
    const noteRef = ref(null)
    const isNoteVisible = ref(false)
    const displayedTime = ref('')

    onMounted(() => {
      displayedTime.value = formatTime(props.note.createdAt)
    })

    onUnmounted(() => {
      isNoteVisible.value = false
    })

    return {
      noteRef,
      displayedTime,
      isNoteVisible
    }
  },
  methods: {
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
        this.discardChanges()
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
      this.reply = null
    },
    handleRestoreClick() {
      this.$emit('restore-note', this.note, this.index)
    },
    updateText(value) {
      this.text = value
    },
    emitInput(value) {
      this.text = value
    }
  }
}
</script>

<style scoped>
.note-content {
  position: relative;
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
}

.note-deleted-cancel {
  margin-top: 8px;
}

.note-reply {
  background-color: var(--overlay-bg-color);
  border-radius: 10px;
  padding: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.note-reply-link {
  color: inherit;
  cursor: pointer;
}

.note-reply-remove-icon {
  cursor: pointer;
  margin-left: 8px;
}

.note-text {
  font-size: 20px;
  word-break: break-word;
}

.note-tags {
  font-size: 16px;
  margin-bottom: 5px;
}

.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  cursor: pointer;
}

.custom-tag {
  background-color: var(--tag-bg-color);
}

.faded-text {
  color: var(--faded-text-color);
}

.note-text-input {
  width: 100%;
  margin-top: 10px;
  font-size: 20px;
}

.character-count {
  text-align: right;
  margin-top: 5px;
  font-size: 14px;
}

.note-placeholder {
  font-size: 20px;
  cursor: pointer;
}
</style>
