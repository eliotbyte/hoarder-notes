<template>
  <div class="grid-content p-4 grid gap-1">
    <!-- Optional Create Note Item -->
    <div v-if="showCreateNoteItem" class="content-block">
      <NoteItem
        :note="{}"
        mode="create"
        :format-time="formatTime"
        :placeholder-text="creationPlaceholder"
        @create-note="handleCreateNote"
        @cancel-create="handleCancelCreate"
      />
    </div>
    <!-- Notes List -->
    <div
      v-for="(note, index) in notes"
      :key="note.id || `note-${note.tempId}`"
      class="content-block"
    >
      <NoteItem
        :note="note"
        :format-time="formatTime"
        :parent-note="note.parentNote"
        :mode="note.mode || 'view'"
        :index="index"
        @create-note="handleCreateNote"
        @update-note="handleUpdateNote"
        @cancel-create="handleCancelCreate"
        @reply-click="handleReplyClick"
        @chat-click="handleChatClick"
        @time-click="handleTimeClick"
        @dropdown-command="handleDropdownCommand"
        @restore-note="handleRestoreNote"
      />
    </div>
    <div v-if="loading">Loading...</div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { useInfiniteScroll } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useDialog } from 'naive-ui'
import NoteItem from './NoteItem.vue'
import api from '@/utils/api.js'

export default {
  name: 'NoteFeed',
  components: {
    NoteItem
  },
  props: {
    spaceId: {
      type: Number,
      default: null
    },
    topicId: {
      type: Number,
      default: null
    },
    parentId: {
      type: Number,
      default: null
    },
    tags: {
      type: Array,
      default: () => []
    },
    notReply: {
      type: Boolean,
      default: false
    },
    showCreateNoteItem: {
      type: Boolean,
      default: false
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('.')[0] + 'Z'
    },
    creationPlaceholder: {
      type: String,
      default: 'Enter text...'
    }
  },
  emits: [
    'reply-click',
    'chat-click',
    'time-click',
    'create-note',
    'update-note',
    'cancel-create'
  ],
  setup(props) {
    const router = useRouter()
    const dialog = useDialog()
    const notes = ref([])
    const loading = ref(false)
    const noMoreNotes = ref(false)
    const page = ref(1)
    const pageSize = ref(10)

    const loadMoreNotes = async () => {
      if (loading.value || noMoreNotes.value) return
      if (!props.spaceId && !props.parentId) {
        loading.value = false
        return
      }
      loading.value = true

      try {
        const params = {
          page: page.value,
          pageSize: pageSize.value,
          date: props.date
        }
        if (props.spaceId) {
          params.spaceId = props.spaceId
        }
        if (props.topicId) {
          params.topicId = props.topicId
        }
        if (props.parentId) {
          params.parentId = props.parentId
        }
        // Add filters
        if (props.tags && props.tags.length > 0) {
          params.tags = props.tags.join(',')
        }
        if (props.notReply) {
          params.notReply = props.notReply
        }
        const response = await api.get('/notes', { params })

        if (response.data.data.length < pageSize.value) {
          noMoreNotes.value = true
        }

        notes.value.push(
          ...response.data.data.map((note) => ({ ...note, mode: 'view' }))
        )
        page.value += 1
      } catch (error) {
        console.error('Error loading notes:', error)
      } finally {
        loading.value = false
      }
    }

    useInfiniteScroll(window, loadMoreNotes, {
      distance: 100,
      immediate: false
    })

    const handleCreateNote = (noteData, index) => {
      // If user is on a specific note page, or we have a parentId prop,
      // we want new notes to have that parentId by default
      if (!noteData.parentId && props.parentId) {
        noteData.parentId = props.parentId
      }

      // if this is a reply
      if (noteData.parentId) {
        const parentNote = notes.value.find((n) => n.id === noteData.parentId)
        if (parentNote) {
          noteData.spaceId = parentNote.spaceId
          noteData.topicId = parentNote.topicId
        } else {
          // fallback
          noteData.spaceId = props.spaceId
          noteData.topicId = props.topicId
        }
      } else {
        noteData.spaceId = props.spaceId
        noteData.topicId = props.topicId
      }
      api
        .post('/notes', noteData)
        .then((response) => {
          // If we were replying in-place:
          if (notes.value[index] && notes.value[index].isReply) {
            notes.value.splice(index, 1, { ...response.data, mode: 'view' })
          } else {
            // Put new note at the top
            notes.value.unshift({ ...response.data, mode: 'view' })
          }
        })
        .catch((error) => {
          console.error('Error creating note:', error)
        })
    }

    const handleUpdateNote = (noteData, note) => {
      noteData.topicId = props.topicId
      noteData.spaceId = props.spaceId
      api
        .put(`/notes/${note.id}`, noteData)
        .then((response) => {
          Object.assign(note, response.data)
          note.mode = 'view'
        })
        .catch((error) => {
          console.error('Error updating note:', error)
        })
    }

    const handleCancelCreate = (index) => {
      if (index !== undefined && notes.value[index] && notes.value[index].isReply) {
        notes.value.splice(index, 1)
      }
    }

    const handleDropdownCommand = (command, note) => {
      if (command === 'edit') {
        note.mode = 'edit'
      } else if (command === 'reply') {
        const index = notes.value.findIndex((n) => n.id === note.id)
        if (index !== -1) {
          if (!notes.value[index + 1] || notes.value[index + 1].isReply !== true) {
            notes.value.splice(index + 1, 0, {
              isReply: true,
              parentNote: note,
              mode: 'create',
              note: {}
            })
          }
        }
      } else if (command === 'delete') {
        dialog.warning({
          title: 'Confirm Deletion',
          content: 'Are you sure you want to delete this note?',
          positiveText: 'Yes',
          negativeText: 'No',
          onPositiveClick: () => {
            deleteNote(note)
          }
        })
      }
    }

    const deleteNote = async (note) => {
      try {
        await api.delete(`/notes/${note.id}`)
        const index = notes.value.findIndex((n) => n.id === note.id)
        if (index !== -1) {
          notes.value[index].deletedAt = new Date().toISOString()
        }
      } catch (error) {
        console.error('Error deleting note:', error)
      }
    }

    const handleRestoreNote = async (note, index) => {
      try {
        await api.put(`/notes/${note.id}/restore`)
        notes.value[index] = { ...note, deletedAt: null, mode: 'view' }
      } catch (error) {
        console.error('Error restoring note:', error)
      }
    }

    const handleReplyClick = (noteItem) => {
      if (noteItem.parentId) {
        router.push(`/notes/${noteItem.parentId}`)
      }
    }

    const handleChatClick = (noteItem) => {
      router.push(`/notes/${noteItem.id}`)
    }

    const handleTimeClick = (noteItem) => {
      router.push(`/notes/${noteItem.id}`)
    }

    const formatTime = (createdAt) => {
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

    const resetFeed = () => {
      notes.value = []
      page.value = 1
      noMoreNotes.value = false
      loadMoreNotes()
    }

    watch(
      () => [
        props.spaceId,
        props.topicId,
        props.parentId,
        props.tags,
        props.notReply,
        props.date
      ],
      () => {
        resetFeed()
      }
    )

    onMounted(() => {
      loadMoreNotes()
    })

    return {
      notes,
      loading,
      handleCreateNote,
      handleUpdateNote,
      handleCancelCreate,
      handleDropdownCommand,
      handleRestoreNote,
      handleReplyClick,
      handleChatClick,
      handleTimeClick,
      formatTime
    }
  }
}
</script>

<style scoped>
.grid-content {
  padding: 16px;
}
</style>
