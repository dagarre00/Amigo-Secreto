
# Guía de Despliegue y Base de Datos

Esta guía detalla cómo configurar la base de datos en Supabase y desplegar la aplicación en Vercel, así como usar el modo de prueba en AI Studio.

## 1. Modo de Prueba (AI Studio / Local)

La aplicación detecta automáticamente si faltan las credenciales de Supabase.

*   **Comportamiento**: Usa `localStorage` para simular la base de datos.
*   **Sincronización**: Funciona entre pestañas del mismo navegador (puedes abrir dos pestañas en AI Studio para simular dos usuarios).
*   **Aviso**: Verás un banner azul indicando "MODO PRUEBA".

## 2. Configuración de Supabase (Producción)

Para persistir datos reales y jugar desde distintos dispositivos, necesitas Supabase.

### A. Crear Proyecto
1. Ve a [database.new](https://database.new) y crea un nuevo proyecto.
2. Guarda la contraseña de la base de datos en un lugar seguro.
3. Una vez creado el proyecto, ve a **Project Settings > API**.
4. Copia la `URL` y la `anon public` Key. Las necesitarás para Vercel.

### B. Crear Tablas (SQL)
Ve al **SQL Editor** en el panel izquierdo de Supabase, crea un "New Query", pega el siguiente código y ejecútalo (Run):

```sql
-- 1. Tabla de Salas (Rooms)
CREATE TABLE rooms (
  code TEXT PRIMARY KEY,
  status TEXT DEFAULT 'LOBBY' CHECK (status IN ('LOBBY', 'REVEAL')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Participantes
CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT REFERENCES rooms(code) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(room_code, name)
);

-- 3. Tabla de Asignaciones (Assignments)
CREATE TABLE assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT REFERENCES rooms(code) ON DELETE CASCADE NOT NULL,
  giver_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Habilitar Realtime
-- Esto permite que la app se actualice automáticamente sin recargar
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE assignments;

-- 5. Row Level Security (RLS) - Opcional para MVP, Recomendado para Prod
-- Habilitar RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para el MVP (Permite leer/escribir a cualquiera con la clave anónima)
CREATE POLICY "Public Access Rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Participants" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Assignments" ON assignments FOR ALL USING (true) WITH CHECK (true);
```

### C. Verificar Realtime
1. Ve a **Database > Replication**.
2. Asegúrate de que `supabase_realtime` esté habilitado y que las tablas `rooms`, `participants` y `assignments` estén listadas dentro de la publicación (el script SQL anterior debería haber hecho esto automáticamente).

---

## 3. Despliegue en Vercel

### A. Preparar el Proyecto
Asegúrate de tener un archivo `vite.config.ts` o similar en la raíz si estás usando Vite, y un `package.json` con los scripts de build (`"build": "tsc && vite build"`).

### B. Importar a Vercel
1. Sube tu código a GitHub.
2. Inicia sesión en [Vercel](https://vercel.com) y haz clic en "Add New > Project".
3. Selecciona tu repositorio.

### C. Variables de Entorno
En la sección "Environment Variables" de la configuración de despliegue en Vercel, añade las siguientes claves. 
*Nota: Para proyectos Vite, es estándar usar el prefijo `VITE_`, la aplicación ha sido actualizada para soportar ambos formatos.*

| Nombre Variable | Valor |
|-----------------|-------|
| `VITE_SUPABASE_URL` | Tu URL de Supabase (Project Settings > API) |
| `VITE_SUPABASE_ANON_KEY` | Tu llave `anon public` de Supabase |
