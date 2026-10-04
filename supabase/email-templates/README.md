# Plantillas de correo (Supabase Auth)

Copia de las plantillas que están en Supabase → Authentication → Emails → Templates.
Supabase no las lee de este repo: si se cambian aquí, hay que pegarlas a mano en el dashboard.

| Archivo | Plantilla | Asunto |
| --- | --- | --- |
| `confirm-signup.html` | Confirm sign up | Confirma tu email en WEND |
| `recovery.html` | Reset password | Restablece tu contraseña de WEND |

Variables de Supabase usadas: `{{ .ConfirmationURL }}`. No renombrar.
