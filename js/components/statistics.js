app.component('settings-component', {
  emits: ['message'],
  
  data() {
    return {
      apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL,
      showApiUrl: false
    }
  },
  
  methods: {
    saveApiUrl() {
      if (this.apiUrl && this.apiUrl.trim()) {
        localStorage.setItem('apiUrl', this.apiUrl.trim());
        this.$emit('message', '✓ API URL uloženo');
      }
    },
    
    resetApiUrl() {
      this.apiUrl = DEFAULT_API_URL;
      localStorage.setItem('apiUrl', DEFAULT_API_URL);
      this.$emit('message', '✓ Obnoveno výchozí URL');
    }
  },
  
  template: '<div class="q-pa-md"><h6 class="q-mt-none">Nastavení API</h6><q-input v-model="apiUrl" label="Apps Script URL" outlined class="q-mb-md"><template v-slot:append><q-icon name="link"/></template></q-input><q-btn @click="saveApiUrl" label="Uložit URL" color="primary" class="full-width q-mb-sm"/><q-btn @click="resetApiUrl" label="Výchozí URL" flat color="grey-7" class="full-width"/></div>'
});
