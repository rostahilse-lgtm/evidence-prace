// Komponenta pro nastavení
window.app.component('settings-component', {
  emits: ['message'],
  
  data() {
    return {
      apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL
    }
  },
  
  methods: {
    saveApiUrl() {
      if (this.apiUrl && this.apiUrl.trim()) {
        localStorage.setItem('apiUrl', this.apiUrl.trim());
        this.$emit('message', '✓ API URL uložena. Obnovte stránku.');
      } else {
        this.$emit('message', 'Zadejte platnou URL');
      }
    },
    
    resetApiUrl() {
      this.apiUrl = DEFAULT_API_URL;
      localStorage.setItem('apiUrl', DEFAULT_API_URL);
      this.$emit('message', '✓ API URL obnovena na výchozí');
    }
  },
  
  template: `
    <div class="q-pa-md">
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Nastavení API</div>
        </q-card-section>
        
        <q-card-section>
          <q-input
            v-model="apiUrl"
            label="API URL"
            outlined
            hint="URL vašeho Google Apps Script API"
          >
            <template v-slot:append>
              <q-icon name="link" />
            </template>
          </q-input>
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn
            flat
            label="Obnovit výchozí"
            color="grey-7"
            @click="resetApiUrl"
          />
          <q-btn
            color="primary"
            label="Uložit"
            @click="saveApiUrl"
            unelevated
          />
        </q-card-actions>
      </q-card>
      
      <q-card>
        <q-card-section>
          <div class="text-h6">O aplikaci</div>
          <div class="text-body2 q-mt-sm">
            Evidence práce 2026<br>
            Verze: 2.0 (modulární)<br>
            <span class="text-grey-7">Aktualizováno: Leden 2026</span>
          </div>
        </q-card-section>
      </q-card>
    </div>
  `
});
