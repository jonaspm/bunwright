const view = new Bun.WebView({ height: 300, width: 300 });
await view.navigate("https://facturacion.supermercadossmart.com/login")

const user = "jperusm@outlook.com"
const password = ""

view.evaluate(`document.querySelector('#correo_login').value = ${user}`);
view.evaluate(`document.querySelector('#pwd_login').value = ${password}`);
view.evaluate(`document.querySelector('#login_in').click()`);
