<template>
  <div class="common-layout">
    <n-layout>
      <HoarderHeader />
      <n-layout-content class="layout-content">
        <n-row :gutter="30" justify="center">
          <n-col :span="12">
            <div class="grid-content p-4 grid gap-1">
              <!-- Main Parent Note -->
              <div class="content-block" v-if="note">
                <NoteItem
                  :note="note"
                  :format-time="formatTime"
                  :mode="'view'"
                />
              </div>
              <!-- Reply Input -->
              <div class="content-block" v-if="note">
                <NoteItem
                  :note="{}"
                  :parent-note="note"
                  mode="create"
                  @create-note="handleCreateNote"
                />
              </div>
              <!-- Feed of Replies -->
              <NoteFeed :parent-id="noteId" :date="date" />
            </div>
          </n-col>
        </n-row>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script>
import { NLayout, NLayoutContent, NRow, NCol } from 'naive-ui'
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import HoarderHeader from '@/components/HoarderHeader.vue'
import NoteItem from '@/components/NoteItem.vue'
import NoteFeed from '@/components/NoteFeed.vue'
import api from '@/utils/api.js'

export default {
  name: 'HoarderSpecificNote',
  components: {
    NLayout,
    NLayoutContent,
    NRow,
    NCol,
    HoarderHeader,
    NoteItem,
    NoteFeed,
  },
  setup() {
    const route = useRoute()
    const noteId = Number(route.params.id)
    const note = ref(null)
    const date = ref(new Date().toISOString().split('.')[0] + 'Z')

    const loadNote = async () => {
      try {
        const response = await api.get(`/notes/${noteId}`)
        note.value = response.data
      } catch (error) {
        console.error('Error loading note:', error)
      }
    }

    const handleCreateNote = (noteData) => {
      noteData.parentId = noteId
      noteData.spaceId = note.value.spaceId
      noteData.topicId = note.value.topicId
      api
        .post('/notes', noteData)
        .then(() => {
          // Optionally, you can reload the feed or handle the new reply
          // For simplicity, let's reload the page
          window.location.reload()
        })
        .catch((error) => {
          console.error('Error creating note:', error)
        })
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
          day: 'numeric',
        })
      } else {
        return created.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      }
    }

    onMounted(() => {
      loadNote()
    })

    return {
      noteId,
      note,
      formatTime,
      handleCreateNote,
      date,
    }
  },
}
</script>

<style scoped>
.common-layout {
  width: 1169px;
  margin: 0 auto;
  position: relative;
  top: 0;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.layout-content {
  padding-top: 80px;
}

.grid-content {
  padding: 16px;
}
</style>
