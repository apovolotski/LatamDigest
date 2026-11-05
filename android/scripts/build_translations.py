"""Reuse the existing iOS translations for shared native UI labels."""
import re,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def read(lang):
 text=(root/f'LatamDigest/Resources/{lang}.lproj/Localizable.strings').read_text()
 return {k:json.loads('"'+v+'"') for k,v in re.findall(r'"([^"\n]+)"\s*=\s*"((?:\\.|[^"\\])*)";',text)}
en=read('en');output={}
extra={
'Your regional briefing':('Tu resumen regional','Seu resumo regional'),
'Read the sources. Keep your perspective.':('Lee las fuentes. Mantén tu perspectiva.','Leia as fontes. Mantenha sua perspectiva.'),
'Country feeds':('Noticias por país','Notícias por país'),
'Explore country feeds':('Explorar noticias por país','Explorar notícias por país'),
'Reading library':('Biblioteca de lectura','Biblioteca de leitura'),
'Research workspace':('Espacio de investigación','Espaço de pesquisa'),
'Countries & topics':('Países y temas','Países e temas'),
'Refresh briefing':('Actualizar resumen','Atualizar resumo'),
'Briefing countries':('Países del resumen','Países do resumo'),
'Review sources':('Revisar fuentes','Revisar fontes'),
'Back to briefing':('Volver al resumen','Voltar ao resumo'),
'Monitoring plans':('Planes de seguimiento','Planos de acompanhamento'),
'Edit monitoring plan':('Editar plan de seguimiento','Editar plano de acompanhamento'),
'Create dossier':('Crear dossier','Criar dossiê'),
'Open dossier':('Abrir dossier','Abrir dossiê'),
'Edit dossier':('Editar dossier','Editar dossiê'),
'Delete dossier':('Eliminar dossier','Excluir dossiê'),
'Back to workspace':('Volver al espacio de trabajo','Voltar ao espaço de trabalho'),
'Export as text':('Exportar como texto','Exportar como texto'),
'Add task':('Añadir tarea','Adicionar tarefa'),
'Choose due date':('Elegir fecha límite','Escolher prazo'),
'Capture reading snapshot':('Guardar instantánea de lectura','Salvar registro de leitura'),
'View snapshot':('Ver instantánea','Ver registro'),
'Reading snapshot':('Instantánea de lectura','Registro de leitura'),
'Daily reading reminder':('Recordatorio diario de lectura','Lembrete diário de leitura'),
'Reminder time':('Hora del recordatorio','Horário do lembrete'),
'Privacy policy':('Política de privacidad','Política de privacidade'),
'Clear reading history':('Borrar historial de lectura','Limpar histórico de leitura'),
'Delete all local data':('Eliminar todos los datos locales','Excluir todos os dados locais'),
'Search headlines and sources':('Buscar titulares y fuentes','Buscar manchetes e fontes'),
'Your note':('Tu nota','Sua nota'),
'Read source':('Leer fuente','Ler fonte'),
'Unsave':('Quitar guardado','Remover dos salvos'),
'Working thesis':('Hipótesis de trabajo','Hipótese de trabalho'),
'Decision summary':('Resumen de decisión','Resumo da decisão'),
'Analyst notes':('Notas de análisis','Notas de análise'),
'Next review date':('Próxima fecha de revisión','Próxima data de revisão'),
'Status / priority / confidence':('Estado / prioridad / confianza','Estado / prioridade / confiança'),
'Exploratory':('Exploratorio','Exploratório'),
'Developing':('En desarrollo','Em desenvolvimento'),
'Confirmed':('Confirmado','Confirmado'),
'Observing':('Observando','Observando'),
'Escalating':('En escalada','Em escalada'),
'Archived':('Archivado','Arquivado'),
'Background':('Secundaria','Secundária'),
'Active':('Activa','Ativa'),
'Urgent':('Urgente','Urgente'),
'Low':('Baja','Baixa'),'Medium':('Media','Média'),'High':('Alta','Alta'),
'Feeds':('Noticias','Notícias'),'Today':('Hoy','Hoje'),'Library':('Biblioteca','Biblioteca'),'Workspace':('Investigación','Pesquisa'),
'Note':('Nota','Nota'),'Dossier':('Dossier','Dossiê'),'Tasks':('Tareas','Tarefas'),'Snapshots':('Instantáneas','Registros'),
'Save':('Guardar','Salvar'),'Cancel':('Cancelar','Cancelar'),'Delete':('Eliminar','Excluir'),'Share':('Compartir','Compartilhar'),
'Title':('Título','Título'),'Notes':('Notas','Notas'),'Conclusion':('Conclusión','Conclusão'),'Next steps':('Próximos pasos','Próximos passos'),'Details':('Detalles','Detalhes'),'Task':('Tarea','Tarefa'),
'Technology':('Tecnología','Tecnologia'),'Public safety':('Seguridad pública','Segurança pública'),'Health':('Salud','Saúde'),'Labor':('Trabajo','Trabalho'),'Energy':('Energía','Energia'),
'Top stories':('Noticias destacadas','Destaques'),'Latest':('Últimas noticias','Últimas notícias'),'Politics':('Política','Política'),'Economy':('Economía','Economia'),'Business':('Negocios','Negócios'),'Culture':('Cultura','Cultura'),'Sports':('Deportes','Esportes'),'World':('Mundo','Mundo'),
'Interface language':('Idioma de la interfaz','Idioma da interface')}
for idx,lang in enumerate(('es','pt')):
 original=read(lang);d={v:original[k] for k,v in en.items() if k in original and '%' not in v};d.update({k:v[idx] for k,v in extra.items()});output[lang]=d
(root/'android/app/src/main/assets/ui-translations.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
