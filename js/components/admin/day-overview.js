window.app.component('day-overview', {
  props: ['allRecords', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      selectedDate: getTodayDate(),
      workers: [],
      
      // Dialogy
      showAddShiftDialog: false,
      showEditShiftDialog: false,
      showAddLunchDialog: false,
      showAddAdvanceDialog: false,
      
      // Formuláře
      newShift: this.getEmptyShift(),
      editShift: this.getEmptyShift(),
      editingRecord: null,
      
      newLunch: {
        workerId: null,
        date: getTodayDate(),
        time: this.getCurrentTime()
      },
      
      newAdvance: {
        workerId: null,
        amount: null,
        reason: '',
        date: getTodayDate()
      }
    }
  },
  
  computed: {
    dayRecords() {
      if (!this.selectedDate || !this.allRecords) return [];
      const parts = this.selectedDate.split('. ');
      const targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      return this.allRecords.filter(r => {
        const recordDate = new Date(r[4]);
        return recordDate >= targetDate && recordDate < nextDay;
      });
    },
    
    workerOptions() {
      return this.workers.map(w => ({ label: w[1], value: w[0] }));
    },
    
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    
    placeOptions() {
      return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [];
    },
    
    totalHours() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[7]) || 0), 0).toFixed(2);
    },
    
    totalKm() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[12]) || 0), 0);
    },
    
    uniqueWorkers() {
      const workers = new Set(this.dayRecords.map(r => r[6]));
      return workers.size;
    }
  },
  
  methods: {
    getEmptyShift() {
      return {
        workerId: null,
        contractId: null,
        jobId: null,
        placeId: null,
        date: getTodayDate(),
        timeStart: '',
        timeEnd: '',
        note: '',
        kmManual: false,
        kmValue: null,
        kmRoundTrip: true
      };
    },
    
    getCurrentTime() {
      const now = new Date();
      return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    },
    
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        this.workers = res.data;
      }
    },
    
    openAddShiftDialog() {
      this.newShift = this.getEmptyShift();
      this.showAddShiftDialog = true;
    },
    
    openEditDialog(record) {
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      
      const recordDate = new Date(record[4]);
      const dateParts = [
        String(recordDate.getDate()).padStart(2, '0'),
        String(recordDate.getMonth() + 1).padStart(2, '0'),
        recordDate.getFullYear()
      ];
      
      this.editShift = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
        date: dateParts.join('. '),
        timeStart: formatTime(record[4]),
        timeEnd: formatTime(record[5]),
        note: record[8] || '',
        kmManual: record[13] === 'Y',
        kmValue: parseFloat(record[11]) || null,
        kmRoundTrip: true
      };
      
      this.editingRecord = record;
      this.showEditShiftDialog = true;
    },
    
    duplicateShift(record) {
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      
      this.newShift = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
        date: getTodayDate(),
        timeStart: '',
        timeEnd: '',
        note: record[8] || '',
        kmManual: record[13] === 'Y',
        kmValue: parseFloat(record[11]) || null,
        kmRoundTrip: true
      };
      
      this.showAddShiftDialog = true;
    },
    
    async saveNewShift() {
      if (!this.newShift.workerId || !this.newShift.contractId || !this.newShift.jobId || 
          !this.newShift.placeId || !this.newShift.timeStart || !this.newShift.timeEnd) {
        this.$emit('message', 'Vyplňte všechna povinná pole');
        return;
      }
      if (!this.newShift.note || this.newShift.note.trim() === '') {
        this.$emit('message', 'Poznámka je povinná');
        return;
      }
      
      const dateParts = this.newShift.date.split('. ');
      const timeParts1 = this.newShift.timeStart.split(':');
      const timeParts2 = this.newShift.timeEnd.split(':');
      
      const timeFrom = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts1[0], timeParts1[1]).getTime();
      const timeTo = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts2[0], timeParts2[1]).getTime();
      
      try {
        const payload = {
          id_contract: this.newShift.contractId,
          id_worker: this.newShift.workerId,
          id_job: this.newShift.jobId,
          id_place: this.newShift.placeId,
          time_fr: timeFrom,
          time_to: timeTo,
          note: this.newShift.note
        };
        
        if (this.newShift.kmManual && this.newShift.kmValue) {
          const kmTotal = this.newShift.kmRoundTrip ? this.newShift.kmValue * 2 : this.newShift.kmValue;
          payload.km_jednosmer = this.newShift.kmValue;
          payload.km_celkem = kmTotal;
          payload.km_rucne = 'Y';
        }
        
        const res = await apiCall('saverecord', payload);
        
        if (res.code === '000') {
          this.$emit('message', '✓ Směna uložena');
          this.showAddShiftDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save shift error:', error);
        this.$emit('message', 'Chyba při ukládání směny');
      }
    },
    
    async saveEditShift() {
      if (!this.editShift.workerId || !this.editShift.contractId || !this.editShift.jobId || 
          !this.editShift.placeId || !this.editShift.timeStart || !this.editShift.timeEnd) {
        this.$emit('message', 'Vyplňte všechna povinná pole');
        return;
      }
      
      const dateParts = this.editShift.date.split('. ');
      const timeParts1 = this.editShift.timeStart.split(':');
      const timeParts2 = this.editShift.timeEnd.split(':');
      
      const timeFrom = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts1[0], timeParts1[1]).getTime();
      const timeTo = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts2[0], timeParts2[1]).getTime();
      
      try {
        const payload = {
          id_contract: this.editShift.contractId,
          id_worker: this.editShift.workerId,
          id_job: this.editShift.jobId,
          id_place: this.editShift.placeId,
          time_fr: timeFrom,
          time_to: timeTo,
          note: this.editShift.note
        };
        
        if (this.editShift.kmManual && this.editShift.kmValue) {
          const kmTotal = this.editShift.kmRoundTrip ? this.editShift.kmValue * 2 : this.editShift.kmValue;
          payload.km_jednosmer = this.editShift.kmValue;
          payload.km_celkem = kmTotal;
          payload.km_rucne = 'Y';
        }
        
        const res = await apiCall('saverecord', payload);
        
        if (res.code === '000') {
          this.$emit('message', '✓ Změny uloženy');
          this.showEditShiftDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Edit shift error:', error);
        this.$emit('message', 'Chyba při úpravě směny');
      }
    },
    
    openAddLunchDialog() {
      this.newLunch = {
        workerId: null,
        date: getTodayDate(),
        time: this.getCurrentTime()
      };
      this.showAddLunchDialog = true;
    },
    
    async saveNewLunch() {
      if (!this.newLunch.workerId) {
        this.$emit('message', 'Vyberte pracovníka');
        return;
      }
      
      const dateParts = this.newLunch.date.split('. ');
      const timeParts = this.newLunch.time.split(':');
      const timestamp = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]).getTime();
      
      try {
        const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
        const res = await apiCall('savelunch', {
          id_worker: this.newLunch.workerId,
          name_worker: worker[1],
          time: timestamp
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Oběd uložen');
          this.showAddLunchDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save lunch error:', error);
        this.$emit('message', 'Chyba při ukládání oběda');
      }
    },
    
    openAddAdvanceDialog() {
      this.newAdvance = {
        workerId: null,
        amount: null,
        reason: '',
        date: getTodayDate()
      };
      this.showAddAdvanceDialog = true;
    },
    
    async saveNewAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      const dateParts = this.newAdvance.date.split('. ');
      const timestamp = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], 12, 0).getTime();
      
      try {
        const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
        const res = await apiCall('saveadvance', {
          id_worker: this.newAdvance.workerId,
          name_worker: worker[1],
          time: timestamp,
          payment: this.newAdvance.amount,
          payment_reason: this.newAdvance.reason
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Záloha uložena');
          this.showAddAdvanceDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save advance error:', error);
        this.$emit('message', 'Chyba při ukládání zálohy');
      }
    }
  },
  
  async mounted() {
    await this.loadWorkers();
  },
  
  template: `
    <div>
      <div class="row q-mb-md items-center">
        <div class="col">
          <q-input v-model="selectedDate" outlined dense label="Datum" readonly>
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="selectedDate" mask="DD. MM. YYYY">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Zavřít" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
        <div class="col-auto q-ml-md">
          <q-btn-dropdown color="primary" label="Přidat" icon="add" dense>
            <q-list>
              <q-item clickable v-close-popup @click="openAddShiftDialog">
                <q-item-section avatar>
                  <q-icon name="work" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Nová směna</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="openAddLunchDialog">
                <q-item-section avatar>
                  <q-icon name="restaurant" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Nový oběd</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="openAddAdvanceDialog">
                <q-item-section avatar>
                  <q-icon name="payment" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Nová záloha</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
      </div>
      
      <div class="row q-gutter-sm q-mb-md">
        <div class="col stat-card">
          <div class="stat-label">Celkem hodin</div>
          <div class="stat-value">{{ totalHours }}</div>
        </div>
        <div class="col stat-card">
          <div class="stat-label">Pracovníků</div>
          <div class="stat-value">{{ uniqueWorkers }}</div>
        </div>
        <div class="col stat-card">
          <div class="stat-label">Celkem km</div>
          <div class="stat-value">{{ totalKm }}</div>
        </div>
      </div>
      
      <div v-if="dayRecords.length === 0" class="text-center text-grey-7 q-mt-lg">
        Žádné záznamy pro tento den
      </div>
      
      <div v-for="(record, idx) in dayRecords" :key="idx" class="record-card">
        <div class="row items-center">
          <div class="col">
            <div class="text-bold">{{ record[6] }}</div>
            <div class="text-caption text-grey-7">{{ record[0] }} • {{ record[3] }} • {{ record[14] || 'Nezadáno' }}</div>
          </div>
          <div class="text-right">
            <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
            <div class="text-caption">{{ record[2] }} Kč/hod</div>
          </div>
          <q-btn flat dense round icon="content_copy" size="sm" class="q-ml-xs" @click="duplicateShift(record)">
            <q-tooltip>Duplikovat</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="edit" size="sm" class="q-ml-xs" @click="openEditDialog(record)">
            <q-tooltip>Upravit</q-tooltip>
          </q-btn>
        </div>
        <div class="text-caption text-grey-7 q-mt-sm">
          {{ formatTimeRange(record[4], record[5]) }}
        </div>
        <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">
          🚗 {{ record[12] }} km
        </div>
        <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
      </div>
      
      <!-- DIALOG - NOVÁ SMĚNA -->
      <q-dialog v-model="showAddShiftDialog">
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Nová směna</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newShift.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="newShift.contractId" :options="contractOptions" 
              label="Zakázka *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="newShift.jobId" :options="jobOptions" 
              label="Práce *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="newShift.placeId" :options="placeOptions" 
              label="Místo práce *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newShift.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newShift.date" mask="DD. MM. YYYY">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <div class="row q-gutter-sm q-mb-sm">
              <div class="col">
                <q-input v-model="newShift.timeStart" label="Čas od (HH:MM)" 
                  outlined dense placeholder="08:00" mask="##:##"/>
              </div>
              <div class="col">
                <q-input v-model="newShift.timeEnd" label="Čas do (HH:MM)" 
                  outlined dense placeholder="16:00" mask="##:##"/>
              </div>
            </div>
            
            <q-input v-model="newShift.note" label="Poznámka *" outlined dense class="q-mb-sm"/>
            
            <q-checkbox v-model="newShift.kmManual" label="Přidat km" dense class="q-mb-sm"/>
            
            <div v-if="newShift.kmManual">
              <q-input v-model.number="newShift.kmValue" label="Km jednosměr" 
                type="number" outlined dense class="q-mb-sm"/>
              <q-checkbox v-model="newShift.kmRoundTrip" label="Tam a zpět (×2)" dense/>
            </div>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveNewShift" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - UPRAVIT SMĚNU -->
      <q-dialog v-model="showEditShiftDialog">
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Upravit směnu</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="editShift.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="editShift.contractId" :options="contractOptions" 
              label="Zakázka *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="editShift.jobId" :options="jobOptions" 
              label="Práce *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="editShift.placeId" :options="placeOptions" 
              label="Místo práce *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="editShift.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="editShift.date" mask="DD. MM. YYYY">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <div class="row q-gutter-sm q-mb-sm">
              <div class="col">
                <q-input v-model="editShift.timeStart" label="Čas od (HH:MM)" 
                  outlined dense mask="##:##"/>
              </div>
              <div class="col">
                <q-input v-model="editShift.timeEnd" label="Čas do (HH:MM)" 
                  outlined dense mask="##:##"/>
              </div>
            </div>
            
            <q-input v-model="editShift.note" label="Poznámka *" outlined dense class="q-mb-sm"/>
            
            <q-checkbox v-model="editShift.kmManual" label="Přidat km" dense class="q-mb-sm"/>
            
            <div v-if="editShift.kmManual">
              <q-input v-model.number="editShift.kmValue" label="Km jednosměr" 
                type="number" outlined dense class="q-mb-sm"/>
              <q-checkbox v-model="editShift.kmRoundTrip" label="Tam a zpět (×2)" dense/>
            </div>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit změny" color="primary" @click="saveEditShift" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - NOVÝ OBĚD -->
      <q-dialog v-model="showAddLunchDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Nový oběd</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newLunch.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newLunch.date" mask="DD. MM. YYYY">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model="newLunch.time" label="Čas (HH:MM)" 
              outlined dense mask="##:##"/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveNewLunch" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - NOVÁ ZÁLOHA -->
      <q-dialog v-model="showAddAdvanceDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Nová záloha</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newAdvance.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newAdvance.date" mask="DD. MM. YYYY">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model.number="newAdvance.amount" label="Částka (Kč) *" 
              type="number" outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newAdvance.reason" label="Důvod *" 
              outlined dense/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveNewAdvance" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
