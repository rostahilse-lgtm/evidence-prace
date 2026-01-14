// Komponenta pro nastavení – opravená verze
window.app.component('settings-component', {
  emits: ['message'],

  data() {
    return {
      apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL,
      isValid: false
    }
  },

  watch: {
    apiUrl(newVal) {
      this.isValid = newVal && newVal.trim() && newVal.includes('/exec');
    }
  },

  methods: {
    saveApiUrl() {
      const url = this.apiUrl.trim();
      if (url && url.includes('/exec')) {
        localStorage.setItem('apiUrl', url);
        this.$emit('message', 'API URL uložena! Obnovte stránku pro načtení dat.');
        this.isValid = true;
      } else {
        this.$emit('message', 'Zadejte platnou URL končící na /exec');
        this.isValid = false;
      }
    },

    resetApiUrl() {
      this.apiUrl = DEFAULT_API_URL;
      localStorage.setItem('apiUrl', DEFAULT_API_URL);
      this.$emit('message', 'API URL obnovena na výchozí');
      this.isValid = false;
    }
  },

  template: `
    <div>
      <q-card>
        <q-card-section>
          <div class="text-h6">Nastavení API</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="apiUrl"
            label="API URL"
            outlined
            :rules="[val => val && val.includes('/exec') || 'Musí končit na /exec']"
            hint="Vložte URL vašeho Google Apps Script (končí /exec)"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            label="Obnovit výchozí"
            @click="resetApiUrl"
          />
          <q-btn
            color="primary"
            label="Uložit"
            :disable="!isValid"
            @click="saveApiUrl"
            unelevated
          />
        </q-card-actions>
      </q-card>

      <q-card class="q-mt-md">
        <q-card-section>
          <div class="text-h6">O aplikaci</div>
          <div class="text-body2 q-mt-sm">
            Evidence práce 2026<br>
            Verze: 2.0 (modulární)<br>
            Backend: Google Apps Script
          </div>
        </q-card-section>
      </q-card>
    </div>
  `
});
