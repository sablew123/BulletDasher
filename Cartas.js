/* ===== Cartas.js =====
 * COMO ESCRIBIR:
 *   - Cada objeto dentro de "cartas" es UNA carta.
 *   - Al recargar la pagina se elige una al azar (abrir/cerrar la ventana no la cambia).
 *   - "texto" puede ser un string suelto, o una lista de strings (cada uno un parrafo).
 *   - "firma" es opcional. Si la pones, sale abajo a la derecha con un guion delante.
 *   - "id" es opcional, solo para ubicarte tu. No se muestra.
 *   - Para agregar: copia un bloque entero, pegalo, y revisa que quede la coma entre bloques.
 *   - Aqui SI puedes usar comillas simples dentro del texto sin problema.
 */

const CARTAS = {

    // La pecera ya usa Pecera.js. Cada carta tiene su propia configuracion de
    // enemigos alla (buscada por este mismo "id"), definida en
    // PECERA_CONFIGS dentro de Pecera.js.
    pecera: {
        script: "Pecera.js",
        activo: true
    },

    cartas: [
    {
        id: "carta001",
        texto: [
            "¿Alguna vez jugando has sentido que esquivas y dasheas de maneras tan épicas y precisas que pareciese que fueras El BulletDasher? Es el estado de flow, el momento en el cual los sentidos de un buen jugador se fusionan con los del BulletDasher, permitiéndole hacer locuras como matar Berserkers sin perder ni una vida."
        ],
        firma: "Easystoteles"
    },
    {
        id: "carta002",
        texto: "Aunque no lo parezca, los modos Classic, Metro y Squasteroids son bastante sencillos y hechos para sobrevivir consistentemente, para El BulletDasher el verdadero desafío está oculto en el menú esperando a ser llamado",
        firma: "Lueasyfer"
    },
    {
        id: "carta003",
        texto: [
            "¿Ya has probado el Practice Mode? ¡Es más que un modo practica común! Gracias al lenguaje bldh serás capaz de hacer verdaderos desafíos o ciclos específicos para lo que necesites entrenar, o encontrarlos en internet, o compartirlos con tus amigos, LO QUE SEA.",
            "La documentación del bldh en el PracticeMode tiene todas las funciones posibles de la primera versión de bldh, con lo cual es más que suficiente para hacer muchas locuras, ¡Buena Suerte!"
        ],
        firma: "EasyFacilongo"
    },
    {
        id: "carta004",
        texto: [
            "Un dia me enfrenté a un ser Dashefisico como yo, el Dasher Caido, el ser que se reveló contra todo y contra todos, el ser que odia a El Elegido, a El BulletDasher...",
            "Tuve que encerrarlo en un espacio oculto del menú, ahora mismo está esperando, si pronuncias su prision en letras de teclado, serás absorbido a su plano, y enfrentarás directamente su nivel de poder y maldad."
        ],
        firma: "Yahveasyh"
    },
    {
        id: "carta005",
        texto: [
		"Buena Suerte.",
		"atentamente yo."
	],
        firma: "El BulletDasher"
    }

]
};
