<template>
  <div class="common-layout">
    <n-layout>
      <HoarderHeader />
      <n-layout-content class="layout-content">
        <n-row :gutter="30">
          <!-- Left Column: Spaces & Topics List -->
          <n-col :span="6">
            <div class="grid-content">
              <div class="content-block">
                <div class="spaces-list">
                  <div
                    v-for="space in spaces"
                    :key="space.id"
                    class="space-item"
                  >
                    <div
                      @click="selectSpace(space)"
                      :class="{ selected: space.id === spaceId }"
                      class="space-name"
                    >
                      {{ space.name }}
                    </div>
                    <transition name="slide">
                      <div v-if="space.id === spaceId" class="topics-list">
                        <div
                          v-for="topic in space.topics"
                          :key="topic.id"
                          @click="selectTopic(space, topic)"
                          :class="{ selected: topic.id === topicId }"
                          class="topic-item"
                        >
                          {{ topic.name }}
                        </div>
                      </div>
                    </transition>
                  </div>
                </div>
              </div>
            </div>
          </n-col>

          <!-- Middle Column: Selected Note + Replies -->
          <n-col :span="12">
            <div class="grid-content p-4">
              <!-- Main Parent Note -->
              <div class="content-block" v-if="note">
                <NoteItem
                  :note="note"
                  :format-time="formatTime"
                  mode="view"
                />
              </div>
              <!-- Feed of Replies -->
              <NoteFeed
                ref="noteFeedRef"
                :parent-id="noteId"
                :date="date"
                :space-id="spaceId"
                :topic-id="topicId"
                :tags="filterTags"
                :not-reply="notReply"
                :show-create-note-item="true"
                creationPlaceholder="Reply to note..."
              />
            </div>
          </n-col>

          <!-- Right Column: Filters Block -->
          <n-col :span="6">
            <div class="grid-content">
              <div class="content-block">
                <div class="filters-list">
                  <div class="filters-header" @click="toggleFilters">
                    <span>Filters</span>
                    <n-icon
                      :style="{
                        transform: filtersExpanded
                          ? 'rotate(90deg)'
                          : 'rotate(0deg)',
                      }"
                      style="float: right"
                    >
                      <ChevronForward />
                    </n-icon>
                  </div>
                  <transition name="slide">
                    <div v-if="filtersExpanded" class="filters-content">
                      <!-- Tag Input -->
                      <TagInput v-model="filterTags" />
                      <!-- Not Reply Checkbox -->
                      <n-checkbox v-model:checked="notReply">
                        Not Reply
                      </n-checkbox>
                    </div>
                  </transition>
                </div>
              </div>
            </div>
          </n-col>
        </n-row>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script>
import { NLayout, NLayoutContent, NRow, NCol, NCheckbox, NIcon } from 'naive-ui'
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import HoarderHeader from '@/components/HoarderHeader.vue'
import NoteItem from '@/components/NoteItem.vue'
import NoteFeed from '@/components/NoteFeed.vue'
import TagInput from '@/components/TagInput.vue'
import { ChevronForward } from '@vicons/ionicons5'
import api from '@/utils/api.js'

export default {
  name: 'HoarderSpecificNote',
  components: {
    NLayout,
    NLayoutContent,
    NRow,
    NCol,
    NCheckbox,
    NIcon,
    HoarderHeader,
    NoteItem,
    NoteFeed,
    TagInput,
    ChevronForward
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const noteId = Number(route.params.id)
    const note = ref(null)
    const date = ref(new Date().toISOString().split('.')[0] + 'Z')

    // For spaces & topics
    const spaces = ref([])
    const spaceId = ref(null)
    const topicId = ref(null)

    // Filters
    const filtersExpanded = ref(false)
    const filterTags = ref([])
    const notReply = ref(false)

    // Reference to NoteFeed
    const noteFeedRef = ref(null)

    const toggleFilters = () => {
      filtersExpanded.value = !filtersExpanded.value
    }

    const updateFiltersInQuery = () => {
      const query = {
        ...route.query,
        tags: filterTags.value.length > 0 ? filterTags.value.join(',') : undefined,
        notReply: notReply.value ? 'true' : undefined
      }
      Object.keys(query).forEach(
        (key) => query[key] === undefined && delete query[key]
      )
      router.replace({ query })
    }

    watch(
      () => filterTags.value,
      () => {
        updateFiltersInQuery()
      },
      { deep: true }
    )

    watch(
      () => notReply.value,
      () => {
        updateFiltersInQuery()
      }
    )

    const loadSpaces = async () => {
      try {
        const response = await api.get('/spaces')
        spaces.value = response.data

        // Check if route.query.spaceId and topicId are set
        if (route.query.spaceId) {
          const sp = spaces.value.find((s) => s.id == route.query.spaceId)
          if (sp) {
            spaceId.value = sp.id
            if (route.query.topicId) {
              const tp = sp.topics.find((t) => t.id == route.query.topicId)
              if (tp) {
                topicId.value = tp.id
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading spaces:', error)
      }
    }

    const selectSpace = (space) => {
      spaceId.value = space.id
      topicId.value = null
    }

    const selectTopic = (space, topic) => {
      spaceId.value = space.id
      topicId.value = topic.id
    }

    watch([spaceId, topicId], ([newSpaceId, newTopicId]) => {
      router.replace({
        query: {
          ...route.query,
          spaceId: newSpaceId,
          topicId: newTopicId
        }
      })
    })

    // Load main note
    const loadNote = async () => {
      try {
        const response = await api.get(`/notes/${noteId}`)
        note.value = response.data
        // Optionally set default spaceId and topicId from note
        if (note.value) {
          spaceId.value = note.value.spaceId
          topicId.value = note.value.topicId
        }
      } catch (error) {
        console.error('Error loading note:', error)
      }
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

    onMounted(() => {
      loadSpaces()
      if (route.query.tags) {
        filterTags.value = route.query.tags.split(',')
      }
      if (route.query.notReply) {
        notReply.value = route.query.notReply === 'true'
      }
      if (route.query.tags || route.query.notReply) {
        filtersExpanded.value = true
      }
      loadNote()
    })

    return {
      noteId,
      note,
      formatTime,
      date,

      // Spaces & topics
      spaces,
      spaceId,
      topicId,
      selectSpace,
      selectTopic,

      // Filters
      filterTags,
      notReply,
      filtersExpanded,
      toggleFilters,

      // NoteFeed ref
      noteFeedRef
    }
  }
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

.p-4 {
  padding: 16px;
}

.spaces-list {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}

.space-item {
  margin-bottom: 8px;
}

.space-name {
  padding: 8px;
  cursor: pointer;
  font-weight: bold;
}

.topics-list {
  margin-left: 16px;
  overflow: hidden;
}

.topic-item {
  padding: 6px 8px;
  cursor: pointer;
}

.selected {
  background-color: var(--selected-bg-color);
  border-radius: 4px;
}

.filters-list {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}

.filters-header {
  padding: 8px;
  cursor: pointer;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters-content {
  margin-left: 16px;
  overflow: hidden;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.5s ease;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 500px;
  opacity: 1;
}
</style>
