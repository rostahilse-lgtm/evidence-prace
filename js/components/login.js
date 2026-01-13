
app.component('login-component', {
  props: ['loading'],
  emits: ['login', 'message'],
  
  data() {
    return {
      loginCode: ''
    }
  },
  
  methods: {
    async handleLogin() {
      if (!this.loginCode) {
        this.$emit('message', 'Zadejte kód pracovníka');
        return;
      }
      
      const res = await apiCall('get', { type: 'workers' });
      
      if (res.code === '000' && res.data) {
        const worker = res.data.find(w => String(w[0]) === String(this.loginCode));
        
        if (worker) {
          this.$emit('login', worker);
        } else {
          this.$emit('message', 'Neplatný kód pracovníka');
        }
      } else {
        this.$emit('message', 'Chyba: ' + (res.error || 'Nepodařilo se načíst data'));
      }
    }
  },
  
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1 style="text-align: center; color: #1976D2; margin-bottom: 2rem;">
          Evidence práce 2026
        </h1>
        <q-input 
          v-model="loginCode" 
          label="Kód pracovníka" 
          type="number" 
          outlined 
          @keyup.enter="handleLogin" 
          class="q-mb-md"
        />
        <q-btn 
          @click="handleLogin" 
          label="Přihlásit" 
          color="primary" 
          :loading="loading" 
          class="full-width q-mt-md" 
          size="lg"
        />
      </div>
    </div>
  `
});
