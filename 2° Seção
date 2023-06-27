<html>
<head>
  <title>2º Seção - Comportamentos desafiadores - Tela de Login</title>
  <style>
    body {
      font-family: Arial, sans-serif;
    }

    h1 {
      font-size: 24px;
      text-align: center;
    }

    #logo {
      display: block;
      margin: 0 auto;
      text-align: center;
      max-width: 300px;
      max-height: 200px;
    }

    #login-form {
      width: 300px;
      margin: 0 auto;
      padding: 20px;
      border: 1px solid #ccc;
    }

    #login-form label {
      display: block;
      margin-bottom: 10px;
    }

    #login-form input[type="text"],
    #login-form input[type="password"] {
      width: 100%;
      padding: 5px;
      margin-bottom: 10px;
    }

    #login-form input[type="submit"] {
      width: 100%;
      padding: 10px;
      background-color: #4CAF50;
      color: #fff;
      border: none;
      cursor: pointer;
    }

    #error-message {
      color: red;
      text-align: center;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <img src="https://drive.google.com/uc?id=1OGO1pmixSc8bkdHxa50BH_Q_ixoHTjU7" alt="Logo" id="logo">
  <h1>2º Seção - Comportamentos desafiadores</h1>
  <div id="login-form">
    <form method="post" action="">
      <label for="username">Usuário:</label>
      <input type="text" id="username" name="username" required>

      <label for="password">Senha:</label>
      <input type="password" id="password" name="password" required>

      <input type="submit" value="Entrar">
    </form>
    <div id="error-message"></div>
  </div>

  <script>
    // Verificar o formulário de login
    var form = document.querySelector('form');
    var errorMessage = document.getElementById('error-message');

    form.addEventListener('submit', function(event) {
      event.preventDefault();
      var username = document.getElementById('username').value;
      var password = document.getElementById('password').value;

      // Verificar usuário e senha
      if (username === 'paciente' && password === 'secao2') {
        // Login bem-sucedido
        window.location.href = 'pagina_de_boas-vindas.html'; // Redirecionar para a página de boas-vindas após o login
      } else {
        // Senha incorreta, exibir mensagem de erro
        errorMessage.textContent = 'Senha incorreta. Por favor, tente novamente.';
      }
    });
  </script>
</body>
</html>
