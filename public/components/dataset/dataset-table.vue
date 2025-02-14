<template>
  <v-container fluid>
    <tutorial-alert id="dataset-table">
      {{ $t('tutorialFilter') }}
    </tutorial-alert>
    <v-row
      v-if="notFound"
      class="px-3"
    >
      <v-col>
        <p v-t="'noData'" />
      </v-col>
    </v-row>
    <template v-else>
      <v-row class="pb-2">
        <v-col class="pb-0">
          <v-row class="px-3 ma-0">
            <dataset-nb-results :total="data.total" />
            <v-btn
              v-if="dataset.isRest && can('createLine')"
              color="primary"
              fab
              x-small
              class="mx-2"
              :disabled="dataset.schema.filter(f => !f['x-calculated']).length === 0"
              :title="$t('addLine')"
              @click="editedLine = null; showEditLineDialog();"
            >
              <v-icon>mdi-plus</v-icon>
            </v-btn>
            <dataset-rest-upload-actions
              v-if="dataset.isRest && can('bulkLines')"
              :dataset="dataset"
            />
          </v-row>
          <v-row class="mr-0">
            <v-col
              lg="3"
              md="4"
              sm="5"
              cols="12"
            >
              <v-text-field
                v-model="query"
                placeholder="Rechercher"
                append-icon="mdi-magnify"
                class="mr-3"
                outlined
                dense
                hide-details
                style="min-width:150px;top:-10px;"
                @input="qMode === 'complete' && refresh(true)"
                @keyup.enter.native="refresh(true)"
                @click:append="refresh(true)"
              />
            </v-col>
            <v-spacer />

            <v-select
              v-show="$vuetify.breakpoint.mdAndUp"
              v-model="pagination.itemsPerPage"
              :items="[{value: 10},{value: 20},{value:50}]"
              :item-text="item => (item.value + ' ' + $t('lines'))"
              hide-details
              dense
              style="max-width: 120px;"
            />
            <v-pagination
              v-if="data.total > pagination.itemsPerPage"
              v-model="pagination.page"
              circle
              :length="Math.ceil(Math.min(data.total, 10000 - pagination.itemsPerPage) / pagination.itemsPerPage)"
              :total-visible="$vuetify.breakpoint.lgAndUp ? 7 : 5"
              class="mx-4"
            />
            <dataset-select-cols
              v-model="selectedCols"
              :headers="headers"
            />
            <dataset-download-results
              :params="downloadParams"
              :total="data.total"
            />
          </v-row>
        </v-col>
      </v-row>
      <v-row v-if="filters.length">
        <v-col class="pa-0">
          <dataset-filters v-model="filters" />
        </v-col>
      </v-row>
      <v-data-table
        :headers="selectedHeaders"
        :items="items"
        item-key="_id"
        :server-items-length="data.total"
        :loading="loading"
        :multi-sort="false"
        :options.sync="pagination"
        hide-default-footer
        hide-default-header
      >
        <template #header>
          <thead class="v-data-table-header">
            <tr>
              <template v-for="(header, h) in selectedHeaders">
                <dataset-table-header-cell
                  :id="'header-cell-' + h"
                  :key="'header-cell-' + h"
                  :header="header"
                  :pagination="pagination"
                />
                <dataset-table-header-menu
                  v-if="header.field"
                  :key="'header-menu-' + h"
                  :activator="'#header-cell-' + h"
                  :header="header"
                  :filters="filters"
                  :filter-height="420"
                  :pagination="pagination"
                  no-fix
                  @filter="f => addFilter(header.value, f)"
                  @hide="hideHeader(header)"
                />
              </template>
            </tr>
          </thead>
        </template>
        <template #item="{item}">
          <v-progress-linear
            v-if="item._tmpState"
            style="position: absolute;opacity: 0.2;"
            indeterminate
            background-opacity="0.5"
            :color="{created: 'success', deleted: 'warning', updated: 'primary', editing: 'primary'}[item._tmpState]"
            height="40"
          />
          <tr>
            <td
              v-for="header in selectedHeaders"
              :key="header.value"
              class="pr-0 pl-4"
              :style="`height: 40px;position:relative;`"
            >
              <div
                v-if="header.value === '_actions'"
                style="min-width:120px;"
              >
                <template v-if="!item._tmpState">
                  <v-btn
                    v-if="can('deleteLine')"
                    icon
                    color="warning"
                    :title="$t('deleteLine')"
                    @click="editedLine = Object.assign({}, item); deleteLineDialog = true;"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                  <v-btn
                    v-if="can('updateLine')"
                    icon
                    color="primary"
                    :title="$t('editLine')"
                    @click="editedLine = Object.assign({}, item); showEditLineDialog();"
                  >
                    <v-icon>mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn
                    v-if="dataset.rest && dataset.rest.history && can('readLineRevisions')"
                    icon
                    color="primary"
                    :title="$t('showRevisions')"
                    @click="showHistoryDialog(item)"
                  >
                    <v-icon>mdi-history</v-icon>
                  </v-btn>
                </template>
              </div>
              <div v-else-if="header.value.startsWith('_ext') && item._tmpState === 'updated'">
                <v-progress-circular
                  size="14"
                  width="2"
                  :indeterminate="true"
                />
              </div>
              <template v-else-if="header.value === '_thumbnail'">
                <v-avatar
                  v-if="item._thumbnail"
                  tile
                  :size="40"
                >
                  <img :src="item._thumbnail">
                </v-avatar>
              </template>
              <template v-else-if="header.value === '_owner'">
                <v-tooltip
                  v-if="item._owner"
                  top
                >
                  <template #activator="{on}">
                    <span
                      class="text-body-2"
                      v-on="on"
                    >
                      <v-avatar :size="28">
                        <img :src="`${env.directoryUrl}/api/avatars/${item._owner.split(':').join('/')}/avatar.png`">
                      </v-avatar>
                    </span>
                  </template>
                  {{ item._ownerName || item._owner }}
                </v-tooltip>
              </template>
              <template v-else-if="digitalDocumentField && digitalDocumentField.key === header.value">
                <!-- attachment_url is empty if the value is an external link -->
                <a :href="item._attachment_url || item[header.value]">{{ item[header.value]| truncate(50) }}</a>
              </template>
              <template v-else-if="webPageField && webPageField.key === header.value">
                <a
                  v-if="item[header.value]"
                  target="_blank"
                  :href="item[header.value]"
                >{{ item[header.value] | truncate(50) }}</a>
              </template>
              <dataset-item-value
                v-else
                :item="item"
                :field="header.field"
                :filters="filters"
                @filter="value => addFilter(header.value, value)"
              />
            </td>
          </tr>
        </template>
      </v-data-table>
    </template>

    <v-dialog
      v-model="editLineDialog"
      max-width="600px"
    >
      <v-card outlined>
        <v-card-title primary-title>
          {{ editedId ? $t('editLine') : $t('addLine') }}
        </v-card-title>
        <v-form
          ref="editLineForm"
          v-model="editLineValid"
        >
          <v-card-text>
            <dataset-edit-line-form
              v-if="editLineDialog && editedLine"
              v-model="editedLine"
              :selected-cols="editedId ? selectedCols : []"
              @onFileUpload="onFileUpload"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              v-t="'cancel'"
              text
              @click="editLineDialog = false"
            />
            <v-btn
              v-t="'save'"
              color="primary"
              :loading="saving"
              :disabled="!editLineValid"
              @click="saveLine"
            />
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="deleteLineDialog"
      max-width="500px"
    >
      <v-card outlined>
        <v-card-title
          v-t="'deleteLine'"
          primary-title
        />
        <v-card-text>
          <v-alert
            v-t="'deleteLineWarning'"
            :value="true"
            type="error"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            v-t="'cancel'"
            text
            @click="deleteLineDialog = false"
          />
          <v-btn
            v-t="'delete'"
            color="warning"
            @click="deleteLine"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="historyDialog"
      max-width="800px"
    >
      <v-card outlined>
        <v-toolbar
          dense
          flat
        >
          <v-toolbar-title v-t="'revisionsHistory'" />
          <v-spacer />
          <v-btn
            icon
            @click.native="historyDialog = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text
          v-if="historyDialog"
          class="pa-0"
        >
          <dataset-history :line="historyLine" />
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<i18n lang="yaml">
fr:
  noData: Les données ne sont pas accessibles. Soit le jeu de données n'a pas encore été entièrement traité, soit il y a eu une erreur dans le traitement.
  tutorialFilter: Appliquez des filtres depuis les entêtes de colonnes et en survolant les valeurs. Triez en cliquant sur les entêtes de colonnes. Cliquez sur le bouton en haut à droite pour télécharger dans un fichier le contenu filtré et trié.
  lines: lignes
  showRevisions: Voir l'historique des révisions de cette ligne
  addLine: Ajouter une ligne
  editLine: Éditer une ligne
  save: Enregistrer
  deleteLine: Supprimer une ligne
  deleteLineWarning: Attention, la donnée de cette ligne sera perdue définitivement.
  cancel: Annuler
  delete: Supprimer
  revisionsHistory: Historique des révisions
en:
  noData: The data is not accessible. Either the dataset was not yet entirely processed, or there was an error.
  tutorialFilter: Apply filters from the headers and by hovering the values. Sort by clicking on the headers. Click on the button on the top to the right to download in a file the filtered and sorted content.
  lines: lines
  showRevisions: Show the history
  addLine: Add a line
  editLine: Edit a line
  save: Save
  deleteLine: Delete a line
  deleteLineWarning: Warning, the data from the line will be lost definitively
  cancel: Cancel
  delete: Delete
  revisionsHistory: Revisions history
</i18n>

<script>
import { mapState, mapGetters } from 'vuex'
import eventBus from '~/event-bus'
const filtersUtils = require('~/assets/filters-utils')

export default {
  data: () => ({
    data: {},
    query: null,
    pagination: {
      page: 1,
      itemsPerPage: 10,
      sortBy: [null],
      sortDesc: [false]
    },
    notFound: false,
    loading: false,
    editLineDialog: false,
    editLineValid: false,
    editedLine: null,
    editedId: null,
    deleteLineDialog: false,
    file: null,
    uploadProgress: 0,
    historyLine: null,
    historyDialog: false,
    filters: [],
    createdLines: [],
    updatedLines: [],
    deletedLines: [],
    saving: false,
    lastParams: null,
    selectedCols: []
  }),
  computed: {
    ...mapState(['vocabulary', 'env']),
    ...mapState('session', ['user']),
    ...mapState('dataset', ['dataset']),
    ...mapGetters('dataset', ['resourceUrl', 'can', 'qMode', 'imageField', 'webPageField', 'digitalDocumentField']),
    headers () {
      const fieldsHeaders = this.dataset.schema
        .filter(field => !field['x-calculated'] || field.key === '_updatedAt')
        .map(field => ({
          text: field.title || field['x-originalName'] || field.key,
          value: field.key,
          sortable:
              (!field['x-capabilities'] || field['x-capabilities'].values !== false) && (
                (field.type === 'string' && field['x-refersTo'] !== 'https://purl.org/geojson/vocab#geometry') ||
                field.type === 'number' ||
                field.type === 'integer'
              ),
          tooltip: field.description || (field['x-refersTo'] && this.vocabulary && this.vocabulary[field['x-refersTo']] && this.vocabulary[field['x-refersTo']].description),
          field
        }))

      if (this.imageField) {
        fieldsHeaders.unshift({ text: '', value: '_thumbnail' })
      }
      if (this.dataset.isRest && (this.can('updateLine') || this.can('deleteLine') || this.can('readLineRevisions'))) {
        fieldsHeaders.unshift({ text: '', value: '_actions' })
      }
      return fieldsHeaders
    },
    cols () {
      return this.headers.filter(h => !!h.field).map(h => h.value)
    },
    selectedHeaders () {
      if (this.selectedCols.length === 0) return this.headers
      return this.headers.filter(h => !h.field || this.selectedCols.includes(h.value))
    },
    params () {
      const params = {
        size: this.pagination.itemsPerPage,
        page: this.pagination.page,
        q_mode: this.qMode
      }
      // truncate on server side for performance, but not for editabled rest datasets
      if (!this.dataset.isRest) params.truncate = 50
      if (this.imageField) params.thumbnail = '40x40'
      if (this.pagination.sortBy[0]) {
        params.sort = (this.pagination.sortDesc[0] ? '-' : '') + this.pagination.sortBy[0]
      }
      if (this.query) params.q = this.query
      if (this.filters.length) {
        try {
          params.qs = filtersUtils.filters2qs(this.filters, this.$i18n.locale)
        } catch (error) {
          // eslint-disable-next-line vue/no-async-in-computed-properties
          this.$nextTick(() => eventBus.$emit('notification', { error }))
        }
      }

      if (this.dataset.finalizedAt) params.finalizedAt = this.dataset.finalizedAt
      if (this.dataset.draftReason) params.draft = 'true'
      return params
    },
    downloadParams () {
      if (this.selectedCols.length === 0) return this.params
      return { ...this.params, select: this.selectedCols.join(',') }
    },
    items () {
      if (!this.data.results) return []
      const items = [...this.data.results]
      items.forEach(item => {
        if (this.deletedLines.find(l => l && l._id === item._id)) {
          item._tmpState = 'deleted'
        } else if (this.updatedLines.find(l => l && l._id === item._id)) {
          Object.assign(item, this.updatedLines.find(l => l && l._id === item._id))
          item._tmpState = 'updated'
        } else if ((this.editLineDialog || this.deleteLineDialog) && this.editedLine && (this.editedLine._id === item._id || this.editedId === item._id)) {
          item._tmpState = 'editing'
        } else {
          item._tmpState = null
        }
      })
      this.createdLines.forEach(l => {
        items.unshift({ _tmpState: 'created', ...l })
      })
      if (this.pagination.sortBy[0] === '_updatedAt') {
        if (this.pagination.sortDesc[0]) items.sort((a, b) => -a._updatedAt.localeCompare(b._updatedAt))
        else items.sort((a, b) => a._updatedAt.localeCompare(b._updatedAt))
      }

      return items
    },
    filtersStorageKey () {
      return `${this.user.id}:dataset:${this.dataset.id}:table-filters`
    },
    selectedColsStorageKey () {
      return `${this.user.id}:dataset:${this.dataset.id}:table-selected-cols`
    }
  },
  watch: {
    async 'dataset.schema' () {
      await this.refresh(true)
      this.createdLines = []
      this.updatedLines = []
      this.deletedLines = []
    },
    pagination: {
      handler () {
        this.refresh()
      },
      deep: true
    },
    filters: {
      handler () {
        localStorage.setItem(this.filtersStorageKey, JSON.stringify(this.filters))
        this.refresh(true)
      },
      deep: true
    },
    selectedCols: {
      handler () {
        localStorage.setItem(this.selectedColsStorageKey, JSON.stringify(this.selectedCols))
      },
      deep: true
    }
  },
  mounted () {
    const storedFilters = localStorage.getItem(this.filtersStorageKey)
    if (storedFilters) this.filters = JSON.parse(storedFilters)
    const storedSelectedCols = localStorage.getItem(this.selectedColsStorageKey)
    if (storedSelectedCols) this.selectedCols = JSON.parse(storedSelectedCols)
    if (this.dataset.schema.find(p => p.key === '_updatedAt')) {
      this.pagination.sortBy = ['_updatedAt']
      this.pagination.sortDesc = [true]
    }
    this.refresh()
  },
  methods: {
    async refresh (resetPagination) {
      if (resetPagination) {
        this.pagination.page = 1
        // this is debatable
        // but in case of full-text search you can forget that a sort is active
        // and be surprised by counter-intuitive results
        this.pagination.sortBy = [null]
      }

      // prevent triggering multiple times the same request
      const paramsStr = JSON.stringify(this.params)
      if (paramsStr === this.lastParams) return
      this.lastParams = paramsStr

      // this.data = {}
      this.loading = true
      try {
        this.data = await this.$axios.$get(this.resourceUrl + '/lines', { params: this.params })
        this.notFound = false
      } catch (error) {
        if (error.response && error.response.status === 404) this.notFound = true
        else eventBus.$emit('notification', { error, msg: 'Erreur pendant la récupération des données' })
      }
      this.loading = false
    },
    orderBy (header) {
      if (!header.sortable) return
      if (this.pagination.sortBy[0] === header.value) {
        this.$set(this.pagination.sortDesc, 0, !this.pagination.sortDesc[0])
      } else {
        this.$set(this.pagination.sortBy, 0, header.value)
        this.$set(this.pagination.sortDesc, 0, true)
      }
    },
    showEditLineDialog () {
      if (!this.editedLine) {
        this.editedId = null
        this.file = null
        this.editedLine = {}
        this.dataset.schema.filter(f => !f['x-calculated']).forEach(f => {
          this.$set(this.editedLine, f.key, null)
        })
      } else {
        this.editedId = this.editedLine._id
      }
      this.uploadProgress = 0
      this.editLineDialog = true
    },
    showHistoryDialog (line) {
      this.historyLine = line
      this.historyDialog = true
    },
    onFileUpload (file) {
      this.file = file
    },
    async saveLine () {
      if (!this.$refs.editLineForm.validate()) return
      this.saving = true
      await new Promise(resolve => setTimeout(resolve, 100))
      const res = await this.$store.dispatch('dataset/saveLine', { line: this.editedLine, file: this.file, id: this.editedId })
      if (this.editedId) this.updatedLines.push(res)
      else this.createdLines.push(res)
      this.saving = false
      this.editLineDialog = false
    },
    async deleteLine () {
      try {
        await this.$axios.$delete(this.resourceUrl + '/lines/' + this.editedLine._id)
        this.deleteLineDialog = false
        this.deletedLines.push(this.editedLine)
      } catch (error) {
        if (error.response && error.response.status === 404) this.notFound = true
        else eventBus.$emit('notification', { error, msg: 'Erreur pendant la suppression de la ligne\'' })
      }
    },
    addFilter (key, filter) {
      if (typeof filter !== 'object') filter = { type: 'in', values: [filter] }
      filter.field = this.dataset.schema.find(f => f.key === key)
      this.filters = this.filters.filter(f => !(f.field.key === key))
      if (filter.type === 'in' && filter.values.length === 0) return
      this.filters.push(filter)
    },
    isFilterable (field, value) {
      if (field['x-capabilities'] && field['x-capabilities'].index === false) return false
      if (field['x-refersTo'] === 'https://purl.org/geojson/vocab#geometry') return false
      if (value === undefined || value === null || value === '') return false
      if (typeof value === 'string' && (value.length > 200 || value.startsWith('{'))) return false
      if (typeof value === 'string' && value.endsWith('...')) return false
      return true
    },
    hideHeader (header) {
      if (!this.selectedCols.length) this.selectedCols = this.cols
      this.selectedCols = this.selectedCols.filter(sc => sc !== header.value)
    }
  }
}
</script>

<style>
.formatted-text-value p:last-child {
  margin-bottom: 0;
}
</style>
