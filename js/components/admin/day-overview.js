window.app.component('day-overview', {
  props: ['allRecords', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      selectedDate: getTodayDate(),
      showAddShiftDialog: false,
      showAddLunchDialog: false,
      showAddAdvanceDialog: false,
      showDuplicateDialog: false,
      workers: [],
      newShift: {
        workerId: null,
        contractId: null,
        jobId: null,
        placeId: null,
        timeStart: null,
        timeEnd: null,
        note: '',
        kmManual: false,
        kmValue: null,
        kmRoundTrip: true,
        customDate: null,
        customTimeStart: '',
        customTimeEnd: ''
      },
      duplicateShift: null,
      newLunch: {
        workerId: null
      },
      newAdvance: {
        workerId: null,
        amount: null,
        reason: ''
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
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        this.workers = res.data;
      }
    },
    
    openAddShiftDialog() {
      this.newShift = {
        workerId: null,
        contractId: null,
        jobId: null,
        placeId: null,
        timeStart: null,
        timeEnd: null,
        note: '',
        kmManual: false,
        kmValue: null,
        kmRoundTrip: true,
        customDate: null,
        customTimeStart: '',
        customTimeEnd: ''
      };
      this.showAddShiftDialog = true;
    },
    
    openDuplicateDialog(record) {
      const worker = this.workers.find(w => w[0] === record[1]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      
      this.newShift = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
        timeStart: null,
        timeEnd: null,
        note: record[8] || '',
        kmManual: record[13] === 'Y',
        kmValue: parseFloat(record[11]) || null,
        kmRoundTrip: true,
        customDate: null,
        customTimeStart: '',
        customTimeEnd: ''
      };
      
      this.showDuplicateDialog = true;
    },
    
    openAddLunchDialog() {
      this.newLunch = { workerId: null };
      this.showAddLunchDialog = true;
    },
    
    openAddAdvanceDialog() {
      this.newAdvance = { workerId: null, amount: null, reason: '' };
      this.showAddAdvanceDialog = true;
    },
    
    setCurrentTime(field) {
      if (field === 'start') {
        this.newShift.timeStart = Date.now();
        this.newShift.customDate = null;
        this.newShift.customTimeStart = '';
      } else {
        this.newShift.timeEnd = Date.now();
        this.newShift.customTimeEnd = '';
      }
    },
    
    applyCustomDateTime() {
      if (!this.newShift.customDate || !this.newShift.customTimeStart) return;
      
      const dateParts = this.newShift.customDate.split('. ');
      const timeParts = this.newShift.customTimeStart.split(':');
      const date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
      this.newShift.timeStart = date.getTime();
      
      if (this.newShift.customTimeEnd) {
        const timeEndParts = this.newShift.customTimeEnd.split(':');
        const dateEnd = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeEndParts[0], timeEndParts[1]);
        this.newShift.timeEnd = dateEnd.getTime();
      }
    },
    
    async saveNewShift() {
      if (this.newShift.customDate && this.newShift.customTimeStart) {
        this.applyCustomDateTime();
      }
      
      if (!this.newShift.workerId || !this.newShift.contractId || !this.newShift.jobId || 
          !this.newShift.placeId || !this.newShift.timeStart || !this.newShift.timeEnd) {
        this.$emit('message', 'Vyplňte všechna povinná pole');
        return;
      }
      if (!this.newShift.note || this.newShift.note.trim() === '') {
        this.$emit('message', 'Poznámka je povinná');
        return;
      }
      
      try {
        const payload = {
          id_contract: this.newShift.contractId,
          id_worker: this.newShift.workerId,
          id_job: this.newShift.jobId,
          id_place: this.newShift.placeId,
          time_fr: this.newShift.timeStart,
          time_to: this.newShift.timeEnd,
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
          this.showDuplicateDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save shift error:', error);
        this.$emit('message', 'Chyba při ukládání směny');
      }
    },
    
    async saveNewLunch() {
      if (!this.newLunch.workerId) {
        this.$emit('message', 'Vyberte pracovníka');
        return;
      }
      
      try {
        const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
        const res = await apiCall('savelunch', {
          id_worker: this.newLunch.workerId,
          name_worker: worker[1],
          time: Date.now()
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
    
    async saveNewAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      try {
        const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
        const res = await apiCall('saveadvance', {
          id_worker: this.newAdvance.workerId,
          name_worker: worker[1],
          time: Date.now(),
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
          <q-btn flat dense round icon="content_copy" size="sm" class="q-ml-sm" @click="openDuplicateDialog(record)">
            <q-tooltip>Duplikovat směnu</q-tooltip>
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
            
            <div class="text-subtitle2 q-mb-sm">Čas</div>
            
            <q-input v-model="newShift.customDate" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newShift.customDate" mask="DD. MM. YYYY">
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
                <q-input v-model="newShift.customTimeStart" label="Čas od (HH:MM)" 
                  outlined dense placeholder="08:00" mask="##:##"/>
              </div>
              <div class="col">
                <q-input v-model="newShift.customTimeEnd" label="Čas do (HH:MM)" 
                  outlined dense placeholder="16:00" mask="##:##"/>
              </div>
            </div>
            
            <div class="text-center q-mb-sm">
              <q-btn dense flat label="Nebo nastavit aktuální čas" size="sm" 
                @click="setCurrentTime('start'); setCurrentTime('end')"/>
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
      
      <!-- DIALOG - DUPLIKOVAT SMĚNU -->
      <q-dialog v-model="showDuplicateDialog">
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">📋 Duplikovat směnu</div>
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
            
            <div class="text-subtitle2 q-mb-sm">Čas</div>
            
            <q-input v-model="newShift.customDate" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newShift.customDate" mask="DD. MM. YYYY">
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
                <q-input v-model="newShift.customTimeStart" label="Čas od (HH:MM)" 
                  outlined dense placeholder="08:00" mask="##:##"/>
              </div>
              <div class="col">
                <q-input v-model="newShift.customTimeEnd" label="Čas do (HH:MM)" 
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
            <q-btn label="Uložit kopii" color="primary" @click="saveNewShift" />
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
              label="Pracovník *" emit-value map-options outlined dense/>
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
