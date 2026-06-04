// =============================================================================
// PRUEBAS DE SISTEMA - TIC TAC TOE PRO
// Herramienta: Cypress
// Encargado: Jose Andrés Loria Herrera
// =============================================================================

// Contador global para generar usuarios únicos
let userCounter = 0;

// Función para generar un usuario único
function generateUniqueUser() {
  userCounter++;
  const timestamp = Date.now();
  const uniqueId = `${timestamp}_${userCounter}`;

  return {
    username: `TestUser${uniqueId}`,
    email: `test${uniqueId}@test.com`,
    password: 'Pass123!'
  };
}

describe('Pruebas de Sistema - Tic Tac Toe Pro', () => {

  // TC-S-01: Registro completo de usuario nuevo 
  it('TC-S-01: Registro completo de usuario nuevo', () => {
    const user = generateUniqueUser();
    cy.visit('/register');
    cy.get('input[name="username"]').type(user.username);
    cy.get('input[type="email"]').type(user.email);
    cy.get('input[type="password"]').first().type(user.password);
    cy.get('input[type="password"]').last().type(user.password);
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/register');
  });

  // TC-S-02: Registro con nombre menor a 1 carácter
  it('TC-S-02: Registro con nombre menor a 1 carácter', () => {
    const user = generateUniqueUser();
    cy.visit('/register');
    // Dejar campo nombre (username) vacío
    cy.get('input[type="email"]').type(user.email);
    cy.get('input[type="password"]').first().type(user.password);
    cy.get('input[type="password"]').last().type(user.password);
    cy.get('button[type="submit"]').click();
    // No debe registrarse
    cy.url().should('include', '/register');
    cy.get('input[name="username"]').then(($input) => {
      expect($input[0].validationMessage).to.not.equal('');
    });
  });

  // TC-S-03: Registro con nombre de 21 caracteres
  it('TC-S-03: Registro con nombre de 21 caracteres', () => {
    const user = generateUniqueUser();
    cy.visit('/register');
    cy.get('input[name="username"]').type('UsuarioMuyLargoParaApp22');
    cy.get('input[type="email"]').type(user.email);
    cy.get('input[type="password"]').first().type(user.password);
    cy.get('input[type="password"]').last().type(user.password);
    cy.get('button[type="submit"]').click();
    // No debe registrarse
    cy.url().should('include', '/register');
  });

  // TC-S-04: Inicio de sesión exitoso
  it('TC-S-04: Inicio de sesión exitoso', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('test@correo.com');
    cy.get('input[type="password"]').type('Pass123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/home');
  });

  // TC-S-05: Inicio de sesión con credenciales incorrectas
  it('TC-S-05: Inicio de sesión con credenciales incorrectas', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('test@correo.com');
    cy.get('input[type="password"]').type('wrongPass');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/login');
    cy.contains('Login Error').should('be.visible');
  });

  // TC-S-06: Iniciar partida contra IA modo fácil
  it('TC-S-06: Iniciar partida contra IA modo fácil', () => {
    cy.visit('/home');
    cy.contains('button', 'AI').click();
    // Seleccionar dificultad fácil
    cy.get('#ai-difficulty-label').closest('.MuiFormControl-root').find('[role="combobox"]').click();
    cy.get('[data-value="easy"]').click({ force: true });
    // Seleccionar tablero 3x3
    cy.get('#board-size-label').closest('.MuiFormControl-root').find('[role="combobox"]').click();
    cy.contains('3 x 3').click({ force: true });
    // Verificar tablero visible
    cy.get('div').filter((i, el) => window.getComputedStyle(el).display === 'grid').first().children().should('have.length', 9);
  });

  // TC-S-07: Partida local dos jugadores - victoria de jugador 1
  it('TC-S-07: Partida local dos jugadores - victoria de jugador 1', () => {
    cy.visit('/home');
    cy.contains('button', 'Local').click();
    const cells = () => cy.get('div').filter((i, el) => window.getComputedStyle(el).display === 'grid').first().children();

    cells().eq(0).click();
    cells().eq(4).click();

    cells().eq(1).click();
    cells().eq(5).click();

    cells().eq(2).click();
    cells().eq(6).click();

    cells().eq(3).click();

    cy.contains(/win|gana/i).should('exist');
  });

  // TC-S-09: Cambio de tema oscuro/claro
  it('TC-S-09: Cambio de tema oscuro/claro', () => {
    cy.visit('/home');
    cy.get('body').then(($body) => {
      const initialBg = $body.css('background-color');
      cy.get('header button').last().click();
      cy.get('body').should(($newBody) => {
        expect($newBody.css('background-color')).not.to.equal(initialBg);
      });
      cy.reload();
      cy.get('body').should(($reloadedBody) => {
        expect($reloadedBody.css('background-color')).not.to.equal(initialBg);
      });
    });
  });

  // TC-S-10: Tablero 3x3 con IA - modo oscuro
  it('TC-S-10: Tablero 3x3 con IA - modo oscuro', () => {
    cy.visit('/home');
    cy.get('header button').last().click();
    cy.contains('button', 'AI').click();
    cy.get('#board-size-label').closest('.MuiFormControl-root').find('[role="combobox"]').click();
    cy.contains('3 x 3').click({ force: true });
    const cells = () => cy.get('div').filter((i, el) => window.getComputedStyle(el).display === 'grid').first().children();
    cells().eq(0).click();
    cy.wait(500);
    cells().filter((i, el) => el.innerText === '').first().click();
    cy.wait(500);
    cells().filter((i, el) => el.innerText === '').first().click();
    // Verificar renderizado en modo oscuro
    cy.get('body').should('have.css', 'background-color').and('not.equal', 'rgb(255, 255, 255)');
  });

  // TC-S-11: Cerrar sesión - logout exitoso
  it('TC-S-11: Cerrar sesión - logout exitoso', () => {
    // Autenticarse primero
    cy.visit('/login');
    cy.get('input[type="email"]').type('test@correo.com');
    cy.get('input[type="password"]').type('Pass123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/home');

    cy.contains('button', 'Logout').click();
    cy.url().should('include', '/login');
    cy.visit('/dashboard');
  });

  // TC-S-12: Registro con email sin formato válido
  it('TC-S-12: Registro con email sin formato válido', () => {
    const user = generateUniqueUser();
    cy.visit('/register');

    cy.get('input[type="email"]').type('correo-invalido');

    cy.get('input[name="username"]').type(user.username);
    cy.get('input[type="password"]').first().type(user.password);
    cy.get('input[type="password"]').last().type(user.password);

    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/register');

    cy.get('input[type="email"]').then(($input) => {
      expect($input[0].validationMessage).to.not.equal('');
    });
  });

  // TC-S-13: Partida contra IA - tablero 8x8 modo difícil
  it('TC-S-13: Partida contra IA - tablero 8x8 modo difícil', () => {
    cy.visit('/home');

    cy.contains('button', 'AI').click();
    cy.get('#board-size-label').closest('.MuiFormControl-root').find('[role="combobox"]').click();
    cy.contains('8 x 8').click({ force: true });
    cy.get('#ai-difficulty-label').closest('.MuiFormControl-root').find('[role="combobox"]').click();
    cy.get('[data-value="hard"]').click({ force: true });

    const cells = () => cy.get('div').filter((i, el) => window.getComputedStyle(el).display === 'grid').first().children();
    cells().eq(0).click();
    cy.wait(500);
    for (let k = 0; k < 4; k++) {
      cells().filter((i, el) => el.innerText === '').first().click();
      cy.wait(500);
    }
    //  Verificar respuesta de IA y estado del tablero (debe haber fichas de la IA "O")
    cells().filter((i, el) => el.innerText === 'O').should('have.length.greaterThan', 0);
  });

  // TC-S-14: Visualización del leaderboard con ranking ELO
  it('TC-S-14: Visualización del leaderboard con ranking ELO', () => {
    cy.visit('/leaderboard');

    cy.get('table, ul, [role="grid"]').should('be.visible');

    cy.contains(/ELO/i).should('be.visible');
  });

});
